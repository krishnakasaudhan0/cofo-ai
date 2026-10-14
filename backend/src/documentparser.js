/**
 * documentparser.js
 * Pass a file (path or Buffer), get its text back in a structured format.
 * Supports: PDF, DOCX, DOC (legacy Word), TXT, MD.
 *
 * Install:   npm i pdfjs-dist mammoth word-extractor
 * Needs:     Node 18+ and "type": "module" in package.json
 *
 * Use in code:
 *   import { parseDocument, parseToSourceText } from './documentparser.js';
 *   const doc  = await parseDocument('./report.pdf');                 // from a path
 *   const doc2 = await parseDocument(req.file.buffer, { filename: req.file.originalname }); // from multer memoryStorage
 *   const text = await parseToSourceText('./report.docx');            // ready for the pipeline
 *
 * Use from the terminal:
 *   node documentparser.js ./report.pdf              # full JSON
 *   node documentparser.js ./report.docx --text      # clean text only
 *
 * Scanned PDFs (images, no text layer) cannot be read without OCR. This parser
 * detects them and tells you (code "NO_TEXT_LAYER") instead of returning an empty string.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/* ----------------------------- defaults ----------------------------- */

const DEFAULTS = {
  maxBytes: 25 * 1024 * 1024, // 25 MB
  maxPages: 300, // PDF pages to read
  filename: null, // needed when passing a Buffer, so the type can be guessed
  minCharsPerPage: 20, // below this average, a PDF is treated as scanned
};

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md'];

export class ParseError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
  }
}

/* ----------------------------- helpers ----------------------------- */

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

/** Tidies extracted text without destroying paragraph breaks. */
function normalizeText(s) {
  return (s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[​‌‍﻿]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectType(buffer, filename) {
  const head = buffer.subarray(0, 8);
  if (head.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (head[0] === 0x50 && head[1] === 0x4b) return 'docx'; // ZIP container ("PK")
  if (head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'doc'; // OLE2

  const ext = filename ? path.extname(filename).toLowerCase() : '';
  if (ext === '.txt' || ext === '.md') return 'txt';
  return null;
}

async function loadInput(input, opts) {
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    return { buffer, filename: opts.filename };
  }
  if (typeof input !== 'string') {
    throw new ParseError('Pass a file path or a Buffer', 'INVALID_INPUT');
  }
  let stat;
  try {
    stat = await fs.stat(input);
  } catch {
    throw new ParseError(`File not found: ${input}`, 'NOT_FOUND');
  }
  if (!stat.isFile()) throw new ParseError(`Not a file: ${input}`, 'NOT_FOUND');
  if (stat.size > opts.maxBytes) {
    throw new ParseError(`File is larger than ${Math.round(opts.maxBytes / 1024 / 1024)} MB`, 'TOO_LARGE');
  }
  return { buffer: await fs.readFile(input), filename: opts.filename || path.basename(input) };
}

/* -------------------------------- PDF -------------------------------- */

/**
 * Rebuilds readable text from pdf.js text items.
 * 1) group items into lines by their y position, 2) join words on a line using x gaps,
 * 3) start a new paragraph where the vertical gap is clearly bigger than this page's normal line spacing.
 */
function itemsToText(items) {
  const lines = [];
  for (const it of items) {
    if (typeof it.str !== 'string' || it.str === '') continue;
    const [, , , , x, y] = it.transform;
    const height = it.height || 10;
    const line = lines[lines.length - 1];
    if (line && Math.abs(line.y - y) < height * 0.5) {
      const gap = x - line.endX;
      if (gap > height * 0.25 && !line.text.endsWith(' ') && !it.str.startsWith(' ')) line.text += ' ';
      line.text += it.str;
      line.endX = x + (it.width || 0);
    } else {
      lines.push({ text: it.str, y, endX: x + (it.width || 0), height });
    }
  }
  if (!lines.length) return '';

  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    if (g > 0) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const normal = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  let out = lines[0].text;
  for (let i = 1; i < lines.length; i++) {
    const g = lines[i - 1].y - lines[i].y;
    const paragraphBreak = normal > 0 && (g > normal * 1.4 || g < 0); // g < 0 = jumped to a new column or page area
    out += (paragraphBreak ? '\n\n' : '\n') + lines[i].text;
  }
  return out;
}

/** Joins words split by a line-end hyphen ("informa-\ntion" -> "information"). */
function dehyphenate(s) {
  return s.replace(/([a-z])-\n([a-z])/g, '$1$2');
}

/** Rejoins visual line wraps: a line that does not end a sentence and is followed by a lowercase start. */
function reflow(s) {
  return s.replace(/([^\n.!?:;])\n(?=[a-z(])/g, '$1 ');
}

async function parsePdf(buffer, opts) {
  let pdfjs;
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  } catch {
    throw new ParseError('PDF support needs pdfjs-dist. Run: npm i pdfjs-dist', 'MISSING_DEPENDENCY');
  }

  let pdf;
  let task;
  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    });
    pdf = await task.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') throw new ParseError('PDF is password protected', 'ENCRYPTED');
    throw new ParseError(`Could not read PDF: ${err?.message || 'invalid file'}`, 'CORRUPT');
  }

  const totalPages = pdf.numPages;
  const limit = Math.min(totalPages, opts.maxPages);
  const pages = [];
  for (let n = 1; n <= limit; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    pages.push({ page: n, text: normalizeText(reflow(dehyphenate(itemsToText(content.items)))) });
    page.cleanup();
  }

  let info = {};
  try {
    info = (await pdf.getMetadata()).info || {};
  } catch {
    /* metadata is optional */
  }
  await (task?.destroy?.() ?? pdf.destroy?.());

  const charCount = pages.reduce((n, p) => n + p.text.length, 0);
  if (charCount < opts.minCharsPerPage * Math.max(1, pages.length) * 0.5 && charCount < 100) {
    throw new ParseError(
      'This PDF has no readable text layer (probably a scanned document). It needs OCR.',
      'NO_TEXT_LAYER'
    );
  }

  return {
    type: 'pdf',
    text: pages.map((p) => p.text).filter(Boolean).join('\n\n'),
    pages,
    meta: {
      title: clean(info.Title) || null,
      author: clean(info.Author) || null,
      subject: clean(info.Subject) || null,
      creator: clean(info.Creator) || null,
      created: info.CreationDate || null,
      pageCount: totalPages,
      pagesRead: limit,
      truncated: limit < totalPages,
    },
    warnings: limit < totalPages ? [`Only the first ${limit} of ${totalPages} pages were read`] : [],
  };
}

/* -------------------------------- DOCX -------------------------------- */

async function parseDocx(buffer) {
  let mammoth;
  try {
    mammoth = (await import('mammoth')).default;
  } catch {
    throw new ParseError('DOCX support needs mammoth. Run: npm i mammoth', 'MISSING_DEPENDENCY');
  }

  let raw;
  let html;
  try {
    raw = await mammoth.extractRawText({ buffer });
    html = await mammoth.convertToHtml({ buffer });
  } catch (err) {
    throw new ParseError(`Could not read DOCX: ${err?.message || 'invalid file'}`, 'CORRUPT');
  }

  // headings and tables come from the HTML conversion
  const headings = [];
  for (const m of html.value.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)) {
    const text = clean(m[2].replace(/<[^>]+>/g, ''));
    if (text) headings.push({ level: Number(m[1]), text: decodeEntities(text) });
  }
  const tables = [];
  for (const t of html.value.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)) {
    const rows = [...t[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => decodeEntities(clean(c[1].replace(/<[^>]+>/g, ' ')))))
      .filter((r) => r.some(Boolean));
    if (rows.length) tables.push({ rows });
  }

  return {
    type: 'docx',
    text: normalizeText(raw.value),
    headings,
    tables,
    meta: {},
    warnings: [...raw.messages, ...html.messages].filter((m) => m.type === 'warning').map((m) => m.message).slice(0, 10),
  };
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/* -------------------------------- DOC -------------------------------- */

async function parseDoc(buffer) {
  let WordExtractor;
  try {
    WordExtractor = (await import('word-extractor')).default;
  } catch {
    throw new ParseError('DOC support needs word-extractor. Run: npm i word-extractor', 'MISSING_DEPENDENCY');
  }
  let doc;
  try {
    doc = await new WordExtractor().extract(buffer);
  } catch (err) {
    throw new ParseError(`Could not read DOC: ${err?.message || 'invalid file'}`, 'CORRUPT');
  }
  return {
    type: 'doc',
    text: normalizeText(doc.getBody()),
    meta: {},
    extras: {
      footnotes: normalizeText(doc.getFootnotes()) || null,
      headers: normalizeText(doc.getHeaders()) || null,
    },
    warnings: [],
  };
}

/* -------------------------------- TXT -------------------------------- */

function parseTxt(buffer) {
  let text;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) text = new TextDecoder('utf-16le').decode(buffer);
  else text = new TextDecoder('utf-8').decode(buffer);
  return { type: 'txt', text: normalizeText(text), meta: {}, warnings: [] };
}

/* ------------------------------ public API ------------------------------ */

/**
 * Parse one document. `input` is a file path or a Buffer.
 * Returns { filename, type, text, meta, stats, warnings, ...type-specific fields }.
 */
export async function parseDocument(input, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const { buffer, filename } = await loadInput(input, opts);

  if (buffer.length === 0) throw new ParseError('File is empty', 'EMPTY');
  if (buffer.length > opts.maxBytes) {
    throw new ParseError(`File is larger than ${Math.round(opts.maxBytes / 1024 / 1024)} MB`, 'TOO_LARGE');
  }

  const type = detectType(buffer, filename);
  if (!type) {
    throw new ParseError(
      `Unsupported file type${filename ? ` (${path.extname(filename) || 'no extension'})` : ''}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
      'UNSUPPORTED_TYPE'
    );
  }

  const parsers = { pdf: () => parsePdf(buffer, opts), docx: () => parseDocx(buffer), doc: () => parseDoc(buffer), txt: () => parseTxt(buffer) };
  const result = await parsers[type]();

  if (!result.text) throw new ParseError('No text could be extracted from this file', 'NO_TEXT');

  const wordCount = result.text.split(/\s+/).length;
  return {
    filename: filename || null,
    sizeBytes: buffer.length,
    parsedAt: new Date().toISOString(),
    ...result,
    stats: {
      wordCount,
      charCount: result.text.length,
      readingTimeMin: Math.max(1, Math.round(wordCount / 200)),
    },
  };
}

/** Convenience: one clean string you can send straight to the pipeline as sourceText. */
export async function parseToSourceText(input, options = {}) {
  const doc = await parseDocument(input, options);
  const title = doc.meta?.title || (doc.filename ? doc.filename.replace(/\.[^.]+$/, '') : 'Document');
  const header = [`# ${title}`];
  if (doc.meta?.author) header.push(`Author: ${doc.meta.author}`);
  if (doc.filename) header.push(`Source file: ${doc.filename}`);
  return `${header.join('\n')}\n\n${doc.text}`;
}

/* ---------------------------------- CLI ---------------------------------- */

async function cli() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('Usage: node documentparser.js <file.pdf|docx|doc|txt|md> [--text]');
    process.exit(1);
  }
  try {
    if (args.includes('--text')) console.log(await parseToSourceText(file));
    else console.log(JSON.stringify(await parseDocument(file), null, 2));
  } catch (err) {
    console.error(`Parse failed [${err.code || 'ERROR'}]: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();