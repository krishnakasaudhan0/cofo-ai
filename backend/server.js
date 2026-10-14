import express from 'express';
import multer from 'multer';
import cors from 'cors';
import extractAndSanitizeUrls from './src/urlSanitizer.js';
import { crawlPage, crawlToSourceText } from './src/webcrawler.js';
import { parseDocument, parseToSourceText } from './src/documentparser.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// Configure Multer for handling file uploads (stored in memory as buffers)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit per file
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * POST /api/v1/ingest
 * Accepts multipart/form-data or JSON: raw_text, urls (JSON array or comma-separated string), and files.
 */
app.post('/api/v1/ingest', upload.array('files'), async (req, res) => {
  try {
    const { raw_text, urls, metadata } = req.body || {};
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

    // 2. Handle URLs (both extracted from raw_text and explicitly provided)
    let explicitUrls = [];
    if (urls) {
      if (typeof urls === 'string') {
        try {
          const parsed = JSON.parse(urls);
          if (Array.isArray(parsed)) {
            explicitUrls = parsed;
          } else if (typeof parsed === 'string') {
            explicitUrls = [parsed];
          }
        } catch (e) {
          explicitUrls = urls.split(',').map((u) => u.trim());
        }
      } else if (Array.isArray(urls)) {
        explicitUrls = urls;
      }
    }

    // Combine, deduplicate, and filter valid URLs
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

    // 4. Generate Canonical Prompt IR (Intermediate Representation)
    const canonicalIr = {
      ir_version: "1.0",
      session_id: `sess_${Date.now()}`,
      timestamp: new Date().toISOString(),
      metadata: parsedMetadata,
      sources: sources,
      total_sources: sources.length,
      status: "compiled"
    };

    return res.status(200).json({
      success: true,
      data: canonicalIr
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
  console.log(`Ingestion API running on port ${PORT}`);
});