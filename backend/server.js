import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import extractAndSanitizeUrls from './src/urlSanitizer.js';
import { crawlPage } from './src/webcrawler.js';
import { parseDocument } from './src/documentparser.js';
import { initDb, prisma } from './src/db.js';
import { projects } from './src/routes/projects.js';
import { jobs } from './src/routes/jobs.js';
import { outputs } from './src/routes/outputs.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure storage output directory exists
const storageDir = path.resolve('storage/outputs');
fs.mkdirSync(storageDir, { recursive: true });

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// Serve static generated outputs (PPTX, SRT, HTML, PDF)
app.use('/storage/outputs', express.static(storageDir));

// Connect to Neon Database
initDb();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cofo-backend', time: new Date().toISOString() });
});

// Telemetry & metrics endpoint for evaluation/demo
app.get('/api/metrics', async (req, res) => {
  try {
    const totalCalls = await prisma.llmCall.count();
    const successfulCalls = await prisma.llmCall.count({ where: { ok: true } });
    const calls = await prisma.llmCall.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    });

    const avgLatency = calls.length > 0 
      ? Math.round(calls.reduce((acc, c) => acc + c.latencyMs, 0) / calls.length) 
      : 0;

    const totalInTokens = calls.reduce((acc, c) => acc + c.inTokens, 0);
    const totalOutTokens = calls.reduce((acc, c) => acc + c.outTokens, 0);

    return res.json({
      totalCalls,
      successfulCalls,
      avgLatencyMs: avgLatency,
      totalInTokens,
      totalOutTokens,
      recentCalls: calls.slice(0, 10)
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Mount modular API routes from COFO-AI specification
app.use('/api', projects);
app.use('/api', jobs);
app.use('/api', outputs);

/**
 * POST /api/v1/ingest
 * Ingestion pipeline creating Layer 1 Source Bundle and compiling Canonical IR
 */
app.post('/api/v1/ingest', multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } 
}).array('files'), async (req, res) => {
  try {
    const { raw_text, urls, metadata, target_outputs, parameters } = req.body || {};
    const uploadedFiles = req.files || [];
    
    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch (e) {
        parsedMetadata = { raw_metadata: metadata };
      }
    }

    const sources = [];
    let extractedUrls = [];

    // 1. Handle Raw Text Input
    if (raw_text && typeof raw_text === 'string' && raw_text.trim()) {
      const sanitizedResult = extractAndSanitizeUrls(raw_text);
      extractedUrls = sanitizedResult.extractedUrls || [];
      const sanitizedPrompt = sanitizedResult.sanitizedPrompt;

      sources.push({
        source_type: "raw_text",
        origin: "user_input",
        content: sanitizedPrompt,
        tokens: sanitizedPrompt ? sanitizedPrompt.split(/\s+/).filter(Boolean).length : 0
      });
    }

    // 2. Handle URLs
    let explicitUrls = [];
    if (urls) {
      if (typeof urls === 'string') {
        try {
          const parsed = JSON.parse(urls);
          if (Array.isArray(parsed)) explicitUrls = parsed;
          else if (typeof parsed === 'string') explicitUrls = [parsed];
        } catch (e) {
          explicitUrls = urls.split(',').map((u) => u.trim());
        }
      } else if (Array.isArray(urls)) {
        explicitUrls = urls;
      }
    }

    const allUrls = [...new Set([...extractedUrls, ...explicitUrls])].filter(
      (u) => typeof u === 'string' && u.trim().length > 0
    );

    for (const rawUrl of allUrls) {
      const targetUrl = rawUrl.trim();
      try {
        const page = await crawlPage(targetUrl, {
          allowPrivate: process.env.ALLOW_PRIVATE_URLS === 'true'
        });

        sources.push({
          source_type: "web_page",
          origin: targetUrl,
          sanitized_url: targetUrl,
          title: page.meta?.title || page.url || targetUrl,
          content: page.content?.markdown || page.content?.text || "",
          status: "success"
        });
      } catch (crawlError) {
        sources.push({
          source_type: "web_page",
          origin: targetUrl,
          sanitized_url: targetUrl,
          status: "failed",
          error: crawlError.message || String(crawlError)
        });
      }
    }
    
    // 3. Handle File Uploads (Document Parser)
    for (const file of uploadedFiles) {
      try {
        const parseResult = await parseDocument(file.buffer, {
          filename: file.originalname
        });

        sources.push({
          source_type: "document",
          origin: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          title: parseResult.meta?.title || file.originalname,
          content: parseResult.text || "",
          status: "success"
        });
      } catch (parseError) {
        sources.push({
          source_type: "document",
          origin: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          status: "failed",
          error: parseError.message || String(parseError)
        });
      }
    }

    // Target outputs and parameters
    let parsedOutputs = [];
    if (target_outputs) {
      try {
        parsedOutputs = typeof target_outputs === 'string' ? JSON.parse(target_outputs) : target_outputs;
      } catch (e) {
        parsedOutputs = [target_outputs];
      }
    }

    let parsedParams = {};
    if (parameters) {
      try {
        parsedParams = typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
      } catch (e) {
        parsedParams = { raw: parameters };
      }
    }

    // Layer 1 Source Bundle
    const sourceBundle = {
      ir_version: "2.0",
      session_id: `sess_${Date.now()}`,
      timestamp: new Date().toISOString(),
      metadata: parsedMetadata,
      target_outputs: parsedOutputs,
      parameters: parsedParams,
      sources: sources,
      total_sources: sources.length,
      status: "compiled"
    };

    return res.status(200).json({
      success: true,
      data: sourceBundle
    });

  } catch (error) {
    console.error("Ingestion error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error during ingestion pipeline execution."
    });
  }
});

app.listen(PORT, () => {
  console.log(`CoFo Ingestion & Generation Engine running on port ${PORT}`);
});