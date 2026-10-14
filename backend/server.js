const express = require('express');
const multer = require('multer');
const cors = require('cors');
const extractAndSanitizeUrls = require('./src/urlSanitizer')
const { crawlPage, crawlToSourceText }= require('./src/webcrawler')
const { parseDocument, parseToSourceText }= require('./src/documentparser')


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Configure Multer for handling file uploads (stored in memory as buffers)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});


const sanitizeUrl = extractAndSanitizeUrls


/**
 * POST /api/v1/ingest
 * Accepts multipart/form-data: raw_text, urls (JSON string or comma-separated), and files.
 */
app.post('/api/v1/ingest', upload.array('files'), async (req, res) => {
  try {
    const { raw_text, urls, metadata } = req.body;
    const uploadedFiles = req.files || [];
    
    let parsedMetadata = {};
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (e) {
        parsedMetadata = { raw_metadata: metadata };
      }
    }

    const sources = [];
    let extractedUrls = [];
    // 1. Handle Raw Text Input
    if (raw_text) {
      const {extractedUrls,sanitizedPrompt} = extractAndSanitizeUrls(raw_text);
      sources.push({
        source_type: "raw_text",
        origin: "user_input",
        content: sanitizedPrompt,
        tokens: raw_text.split(/\s+/).length // Basic rough token estimate
      });
    }

    // 2. Handle URLs (Sanitize + Crawl)
    if (urls) {
      // Support both comma-separated strings and JSON arrays
      let urlList = [];
      if (typeof urls === 'string') {
        try {
          urlList = JSON.parse(urls);
        } catch (e) {
          urlList = urls.split(',').map(u => u.trim());
        }
      } else if (Array.isArray(urls)) {
        urlList = urls;
      }

      urlList = [...new Set([...extractedUrls, ...urlList])];

      for (const rawUrl of urlList) {
        if (!rawUrl) continue;
        const sanitizedUrl = rawUrl;  //no sanitization for now as per requirements
        
        try {
          const crawlResult = await crawlToSourceText(sanitizedUrl);
          
          sources.push({
            source_type: "web_page",
            origin: rawUrl,
            sanitized_url: sanitizedUrl,
            title: crawlResult.title,
            content: crawlResult.content,
            status: "success"
          });
        } catch (crawlError) {
          sources.push({
            source_type: "web_page",
            origin: rawUrl,
            sanitized_url: sanitizedUrl,
            status: "failed",
            error: crawlError.message
          });
        }
      }
    }
    
    // 3. Handle File Uploads (Document Parser)
    for (const file of uploadedFiles) {
      try {
        const parseResult = await parseDocument(file.buffer, file.originalname);
        sources.push({
          source_type: "document",
          origin: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          content: parseResult.content,
          status: "success"
        });
      } catch (parseError) {
        sources.push({
          source_type: "document",
          origin: file.originalname,
          status: "failed",
          error: parseError.message
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
      error: "Internal Server Error during ingestion pipeline execution."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Ingestion API running on port ${PORT}`);
});