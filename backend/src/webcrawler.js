/**
 * webcrawler.js
 * Pass a link, get the website's content back in a structured format.
 *
 * Install:   npm i jsdom @mozilla/readability turndown
 * Needs:     Node 18+ and "type": "module" in package.json
 *
 * Use in code:
 *   import { crawlPage, crawlSite, crawlToSourceText } from './webcrawler.js';
 *   const page = await crawlPage('https://example.com/article');
 *   const text = await crawlToSourceText('https://example.com/article'); // ready for the pipeline
 *
 * Use from the terminal:
 *   node webcrawler.js https://example.com/article            # full JSON
 *   node webcrawler.js https://example.com/article --text     # clean markdown only
 *   node webcrawler.js https://example.com --site 5           # crawl up to 5 pages of the same site
 *
 * Optional (JavaScript-rendered sites): npm i playwright && npx playwright install chromium
 *   then call crawlPage(url, { render: true })
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

/* ----------------------------- defaults ----------------------------- */

const DEFAULTS = {
  timeoutMs: 15000,
  maxBytes: 5 * 1024 * 1024, // 5 MB
  maxRedirects: 5,
  maxLinks: 200,
  maxImages: 50,
  userAgent: 'AurafarmerCrawler/1.0 (+content transformation research tool)',
  allowPrivate: false, // keep false when the URL comes from a user (SSRF protection)
  render: false, // true = use Playwright for JavaScript-rendered pages
  includeHtml: false, // true = also return the cleaned article HTML
};

export class CrawlError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CrawlError';
    this.code = code;
  }
}

/* ------------------------ URL safety (SSRF guard) ------------------------ */

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80')) return true;
    if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7));
    return false;
  }
  return true;
}

async function assertSafeUrl(urlString, allowPrivate) {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new CrawlError(`Invalid URL: ${urlString}`, 'INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new CrawlError('Only http and https URLs are allowed', 'INVALID_PROTOCOL');
  }
  if (allowPrivate) return url;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host)
    ? [{ address: host }]
    : await dns.lookup(host, { all: true }).catch(() => {
        throw new CrawlError(`Could not resolve host: ${host}`, 'DNS_FAILED');
      });
  // Note: a determined attacker could still rebind DNS between this check and the fetch.
  // For a hackathon / 2-user app this is fine; for production, pin the resolved IP.
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new CrawlError('Refusing to fetch a private or internal address', 'PRIVATE_ADDRESS');
  }
  return url;
}

/* ------------------------------ fetching ------------------------------ */

function decodeBody(buffer, contentType) {
  let charset = /charset=["']?([\w-]+)/i.exec(contentType || '')?.[1];
  if (!charset) {
    const head = buffer.subarray(0, 2048).toString('latin1');
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder(charset || 'utf-8').decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

async function readLimited(res, maxBytes) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new CrawlError(`Page is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`, 'TOO_LARGE');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchHtml(startUrl, opts) {
  let current = startUrl;
  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    await assertSafeUrl(current, opts.allowPrivate);

    let res;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(opts.timeoutMs),
        headers: {
          'User-Agent': opts.userAgent,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Language': 'en;q=0.9,*;q=0.5',
        },
      });
    } catch (err) {
      if (err.name === 'TimeoutError') throw new CrawlError('Request timed out', 'TIMEOUT');
      throw new CrawlError(`Network error: ${err.cause?.code || err.message}`, 'NETWORK');
    }

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).href; // re-validated at the top of the loop
      continue;
    }
    if (!res.ok) throw new CrawlError(`HTTP ${res.status} ${res.statusText}`, `HTTP_${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (!/html|xml|text\/plain/i.test(contentType)) {
      throw new CrawlError(`Unsupported content type: ${contentType || 'unknown'}`, 'UNSUPPORTED_TYPE');
    }

    const buffer = await readLimited(res, opts.maxBytes);
    return { html: decodeBody(buffer, contentType), finalUrl: current, status: res.status };
  }
  throw new CrawlError('Too many redirects', 'TOO_MANY_REDIRECTS');
}

async function renderWithBrowser(url, opts) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch {
    throw new CrawlError('render:true needs Playwright. Run: npm i playwright && npx playwright install chromium', 'NO_PLAYWRIGHT');
  }
  await assertSafeUrl(url, opts.allowPrivate);
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: opts.userAgent });
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: opts.timeoutMs * 2 });
    const html = await page.content();
    return { html, finalUrl: page.url(), status: response?.status() ?? 200 };
  } finally {
    await browser.close();
  }
}

/* ----------------------------- helpers ----------------------------- */

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const abs = (href, base) => {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
};

function metaContent(doc, selectors) {
  for (const sel of selectors) {
    const v = doc.querySelector(sel)?.getAttribute('content')?.trim();
    if (v) return v;
  }
  return null;
}

function parseJsonLd(doc) {
  const out = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      out.push(...items.filter((x) => x && typeof x === 'object'));
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return out;
}

function authorName(a) {
  if (!a) return null;
  if (typeof a === 'string') return a;
  if (Array.isArray(a)) return a.map(authorName).filter(Boolean).join(', ') || null;
  return a.name || null;
}

function extractMeta(doc, finalUrl, jsonLd) {
  const ld = jsonLd.find((x) => x.datePublished || x.author || x.headline) || {};
  const canonicalHref = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
  const image = metaContent(doc, ['meta[property="og:image"]', 'meta[name="twitter:image"]']);
  const keywords = metaContent(doc, ['meta[name="keywords"]']);

  return {
    title: clean(metaContent(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) || doc.title) || null,
    description: metaContent(doc, ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']),
    canonical: canonicalHref ? abs(canonicalHref, finalUrl) : null,
    language: doc.documentElement.getAttribute('lang') || metaContent(doc, ['meta[property="og:locale"]']),
    siteName: metaContent(doc, ['meta[property="og:site_name"]']),
    author: metaContent(doc, ['meta[name="author"]', 'meta[property="article:author"]']) || authorName(ld.author),
    publishedTime:
      metaContent(doc, ['meta[property="article:published_time"]', 'meta[name="date"]', 'meta[itemprop="datePublished"]']) ||
      ld.datePublished ||
      doc.querySelector('time[datetime]')?.getAttribute('datetime') ||
      null,
    modifiedTime: metaContent(doc, ['meta[property="article:modified_time"]']) || ld.dateModified || null,
    image: image ? abs(image, finalUrl) : null,
    keywords: keywords ? keywords.split(',').map(clean).filter(Boolean) : [],
    type: metaContent(doc, ['meta[property="og:type"]']),
  };
}

/* ------------------- content structure (sections, tables) ------------------- */

function tableToRows(table) {
  return [...table.querySelectorAll('tr')]
    .map((tr) => [...tr.querySelectorAll('th,td')].map((c) => clean(c.textContent)))
    .filter((r) => r.some(Boolean));
}

/** Walks the main content and groups it under its headings. */
function buildStructure(root) {
  const headings = [];
  const sections = [];
  const tables = [];
  let current = { heading: null, level: 0, parts: [] };

  const flush = () => {
    const text = current.parts.join('\n\n').trim();
    if (current.heading || text) sections.push({ heading: current.heading, level: current.level, text });
  };

  const nodes = root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,table');
  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();
    if (!/^h[1-6]$/.test(tag) && el.parentElement?.closest('blockquote,li,table')) continue; // already covered by its parent

    if (/^h[1-6]$/.test(tag)) {
      const text = clean(el.textContent);
      if (!text) continue;
      flush();
      const level = Number(tag[1]);
      headings.push({ level, text });
      current = { heading: text, level, parts: [] };
    } else if (tag === 'table') {
      const rows = tableToRows(el);
      if (rows.length) {
        tables.push({ caption: clean(el.querySelector('caption')?.textContent) || null, section: current.heading, rows });
        current.parts.push(rows.map((r) => r.join(' | ')).join('\n'));
      }
    } else if (tag === 'li') {
      const text = clean(el.textContent);
      if (text) current.parts.push(`- ${text}`);
    } else if (tag === 'pre') {
      const text = el.textContent.trim();
      if (text) current.parts.push('```\n' + text + '\n```');
    } else if (tag === 'blockquote') {
      const text = clean(el.textContent);
      if (text) current.parts.push(`> ${text}`);
    } else {
      const text = clean(el.textContent);
      if (text) current.parts.push(text);
    }
  }
  flush();

  // merge consecutive list items into one block for readability
  for (const s of sections) s.text = s.text.replace(/\n\n(?=- )/g, '\n');
  return { headings, sections, tables };
}

/* -------------------------------- extraction -------------------------------- */

function makeTurndown() {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '_' });
  td.remove(['script', 'style', 'noscript', 'iframe']);
  return td;
}

/**
 * Turns raw HTML into the structured result. Exported so you can also use it
 * on HTML you already have (for example from an uploaded .html file).
 */
export function extractFromHtml(html, finalUrl, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const virtualConsole = new VirtualConsole(); // swallow CSS/script warnings
  const dom = new JSDOM(html, { url: finalUrl, virtualConsole });
  const doc = dom.window.document;

  const jsonLd = parseJsonLd(doc);
  const meta = extractMeta(doc, finalUrl, jsonLd);
  const pageHost = new URL(finalUrl).hostname;

  // links and images come from the full page, before Readability changes anything
  const links = [];
  const seenLinks = new Set();
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = abs(a.getAttribute('href'), finalUrl);
    if (!href || !/^https?:/.test(href)) continue;
    const noHash = href.split('#')[0];
    if (seenLinks.has(noHash)) continue;
    seenLinks.add(noHash);
    links.push({ text: clean(a.textContent).slice(0, 120), href: noHash, internal: new URL(noHash).hostname === pageHost });
    if (links.length >= opts.maxLinks) break;
  }

  const images = [];
  for (const img of doc.querySelectorAll('img[src]')) {
    const src = abs(img.getAttribute('src'), finalUrl);
    if (!src || !/^https?:/.test(src) || src.startsWith('data:')) continue;
    images.push({ src, alt: clean(img.getAttribute('alt')) || null });
    if (images.length >= opts.maxImages) break;
  }

  // main content: Readability first, plain fallback second
  let article = null;
  try {
    article = new Readability(doc.cloneNode(true), { charThreshold: 200 }).parse();
  } catch {
    /* fall through to fallback */
  }

  let contentHtml;
  let extractor = 'readability';
  let byline = null;
  let excerpt = null;
  let title = meta.title;

  if (article && clean(article.textContent).length >= 200) {
    contentHtml = article.content;
    byline = article.byline ? clean(article.byline) : null;
    excerpt = article.excerpt ? clean(article.excerpt) : null;
    title = clean(article.title) || title;
  } else {
    extractor = 'fallback';
    const copy = doc.cloneNode(true);
    copy.querySelectorAll('script,style,noscript,nav,footer,header,aside,form,iframe,svg').forEach((n) => n.remove());
    const root = copy.querySelector('main') || copy.querySelector('article') || copy.body;
    contentHtml = root ? root.innerHTML : '';
  }

  const contentDom = new JSDOM(`<body>${contentHtml}</body>`, { virtualConsole });
  const contentRoot = contentDom.window.document.body;
  const text = clean(contentRoot.textContent);
  const { headings, sections, tables } = buildStructure(contentRoot);
  const markdown = makeTurndown().turndown(contentHtml).replace(/\n{3,}/g, '\n\n').trim();
  const wordCount = text ? text.split(/\s+/).length : 0;

  return {
    url: finalUrl,
    meta: { ...meta, title, author: meta.author || byline },
    content: {
      extractor, // "readability" = clean article found, "fallback" = best effort
      excerpt: excerpt || meta.description || text.slice(0, 280),
      text: contentRoot.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim(),
      markdown,
      headings,
      sections,
      tables,
      ...(opts.includeHtml ? { html: contentHtml } : {}),
    },
    links,
    images,
    structuredData: jsonLd.slice(0, 10),
    stats: { wordCount, readingTimeMin: Math.max(1, Math.round(wordCount / 200)) },
  };
}

/* ------------------------------ public API ------------------------------ */

/** Crawl ONE page. Pass a link, get structured content back. */
export async function crawlPage(url, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const { html, finalUrl, status } = opts.render ? await renderWithBrowser(url, opts) : await fetchHtml(url, opts);
  const result = extractFromHtml(html, finalUrl, opts);
  return { requestedUrl: url, status, fetchedAt: new Date().toISOString(), ...result };
}

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|svg|webp|zip|mp4|mp3|css|js|xml|ico|woff2?)(\?|$)/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Crawl several pages starting from one link (breadth-first, same site by default). */
export async function crawlSite(startUrl, { maxPages = 5, sameOrigin = true, delayMs = 500, ...options } = {}) {
  const queue = [startUrl];
  const seen = new Set([startUrl.split('#')[0]]);
  const pages = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    try {
      const page = await crawlPage(url, options);
      pages.push(page);
      for (const link of page.links) {
        if (sameOrigin && !link.internal) continue;
        if (SKIP_EXT.test(link.href) || seen.has(link.href)) continue;
        seen.add(link.href);
        queue.push(link.href);
      }
    } catch (err) {
      pages.push({ requestedUrl: url, error: { code: err.code || 'ERROR', message: err.message } });
    }
    if (queue.length && pages.length < maxPages) await sleep(delayMs);
  }
  return pages;
}

/** Convenience: returns one clean string you can send straight to the content pipeline as sourceText. */
export async function crawlToSourceText(url, options = {}) {
  const page = await crawlPage(url, options);
  const header = [`# ${page.meta.title || page.url}`];
  if (page.meta.author) header.push(`Author: ${page.meta.author}`);
  if (page.meta.publishedTime) header.push(`Published: ${page.meta.publishedTime}`);
  header.push(`Source: ${page.url}`);
  return `${header.join('\n')}\n\n${page.content.markdown}`;
}

/* ---------------------------------- CLI ---------------------------------- */

async function cli() {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
  if (!url) {
    console.error('Usage: node webcrawler.js <url> [--text] [--site N] [--render]');
    process.exit(1);
  }
  const siteIdx = args.indexOf('--site');
  const options = { render: args.includes('--render') };

  try {
    if (siteIdx !== -1) {
      const maxPages = Number(args[siteIdx + 1]) || 5;
      console.log(JSON.stringify(await crawlSite(url, { maxPages, ...options }), null, 2));
    } else if (args.includes('--text')) {
      console.log(await crawlToSourceText(url, options));
    } else {
      console.log(JSON.stringify(await crawlPage(url, options), null, 2));
    }
  } catch (err) {
    console.error(`Crawl failed [${err.code || 'ERROR'}]: ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) cli();
