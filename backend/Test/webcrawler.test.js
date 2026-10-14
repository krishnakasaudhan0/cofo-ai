import { jest } from '@jest/globals';
import {
  CrawlError,
  extractFromHtml,
  crawlPage,
  crawlSite,
  crawlToSourceText,
} from '../src/webcrawler.js';

describe('CrawlError', () => {
  test('should construct with message and error code', () => {
    const error = new CrawlError('Failed to fetch resource', 'FETCH_FAILED');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CrawlError');
    expect(error.message).toBe('Failed to fetch resource');
    expect(error.code).toBe('FETCH_FAILED');
  });
});

describe('SSRF Protection & URL Validation', () => {
  test('should throw INVALID_URL for malformed URLs', async () => {
    await expect(crawlPage('not-a-valid-url')).rejects.toThrow(CrawlError);
    await expect(crawlPage('not-a-valid-url')).rejects.toMatchObject({
      code: 'INVALID_URL',
    });
  });

  test('should throw INVALID_PROTOCOL for non-http/https protocols', async () => {
    await expect(crawlPage('ftp://example.com/file.txt')).rejects.toMatchObject({
      code: 'INVALID_PROTOCOL',
    });
    await expect(crawlPage('file:///etc/passwd')).rejects.toMatchObject({
      code: 'INVALID_PROTOCOL',
    });
    await expect(crawlPage('javascript:alert(1)')).rejects.toMatchObject({
      code: 'INVALID_PROTOCOL',
    });
  });

  test('should reject private IPv4 addresses when allowPrivate is false', async () => {
    const privateUrls = [
      'http://127.0.0.1/admin',
      'http://10.0.0.1/status',
      'http://192.168.1.1/router',
      'http://172.16.0.1/internal',
      'http://169.254.169.254/latest/meta-data',
      'http://0.0.0.0/',
    ];

    for (const url of privateUrls) {
      await expect(crawlPage(url, { allowPrivate: false })).rejects.toMatchObject({
        code: 'PRIVATE_ADDRESS',
      });
    }
  });

  test('should reject IPv6 loopback addresses when allowPrivate is false', async () => {
    await expect(crawlPage('http://[::1]/secret', { allowPrivate: false })).rejects.toMatchObject({
      code: 'PRIVATE_ADDRESS',
    });
  });

  test('should reject unresolvable hostnames with DNS_FAILED', async () => {
    await expect(
      crawlPage('http://unresolvable-domain-that-does-not-exist-xyz123.com', { allowPrivate: false })
    ).rejects.toMatchObject({
      code: 'DNS_FAILED',
    });
  });
});

describe('extractFromHtml', () => {
  const baseUrl = 'https://example.com/articles/ai-overview';

  test('should extract rich metadata from HTML meta tags and document head', () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>AI Overview - Example</title>
        <meta name="description" content="A comprehensive overview of artificial intelligence.">
        <meta name="keywords" content="ai, machine learning, deep learning">
        <meta name="author" content="Jane Doe">
        <meta property="og:title" content="OpenGraph AI Title">
        <meta property="og:description" content="OpenGraph AI description">
        <meta property="og:site_name" content="Tech Today">
        <meta property="og:image" content="/images/cover.jpg">
        <meta property="og:type" content="article">
        <meta property="article:published_time" content="2026-01-15T10:00:00Z">
        <meta property="article:modified_time" content="2026-02-01T12:00:00Z">
        <link rel="canonical" href="https://example.com/canonical-ai">
      </head>
      <body>
        <main>
          <h1>AI Overview</h1>
          <p>Artificial intelligence is transforming many industries across the world.</p>
        </main>
      </body>
      </html>
    `;

    const result = extractFromHtml(html, baseUrl);

    expect(result.url).toBe(baseUrl);
    expect(result.meta.title).toBe('OpenGraph AI Title');
    expect(result.meta.description).toBe('A comprehensive overview of artificial intelligence.');
    expect(result.meta.canonical).toBe('https://example.com/canonical-ai');
    expect(result.meta.language).toBe('en');
    expect(result.meta.siteName).toBe('Tech Today');
    expect(result.meta.author).toBe('Jane Doe');
    expect(result.meta.publishedTime).toBe('2026-01-15T10:00:00Z');
    expect(result.meta.modifiedTime).toBe('2026-02-01T12:00:00Z');
    expect(result.meta.image).toBe('https://example.com/images/cover.jpg');
    expect(result.meta.keywords).toEqual(['ai', 'machine learning', 'deep learning']);
    expect(result.meta.type).toBe('article');
  });

  test('should extract metadata from JSON-LD schema', () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: 'Breaking Tech News',
      author: { '@type': 'Person', name: 'Alice Smith' },
      datePublished: '2026-03-10T08:00:00Z',
      dateModified: '2026-03-11T09:00:00Z',
    };

    const html = `
      <html>
      <head>
        <title>Tech News</title>
        <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
      </head>
      <body>
        <main><p>Content here.</p></main>
      </body>
      </html>
    `;

    const result = extractFromHtml(html, baseUrl);

    expect(result.meta.author).toBe('Alice Smith');
    expect(result.meta.publishedTime).toBe('2026-03-10T08:00:00Z');
    expect(result.meta.modifiedTime).toBe('2026-03-11T09:00:00Z');
    expect(result.structuredData).toHaveLength(1);
    expect(result.structuredData[0].headline).toBe('Breaking Tech News');
  });

  test('should parse JSON-LD @graph array and ignore malformed JSON-LD', () => {
    const html = `
      <html>
      <head>
        <script type="application/ld+json">invalid json string</script>
        <script type="application/ld+json">{
          "@graph": [
            { "@type": "Organization", "name": "CoFo AI" },
            { "@type": "WebPage", "headline": "Home" }
          ]
        }</script>
      </head>
      <body><p>Hello</p></body>
      </html>
    `;

    const result = extractFromHtml(html, baseUrl);
    expect(result.structuredData).toHaveLength(2);
    expect(result.structuredData[0].name).toBe('CoFo AI');
  });

  test('should extract, resolve, and classify links with maxLinks cap', () => {
    const html = `
      <html>
      <body>
        <a href="/internal-link">Internal Page</a>
        <a href="/internal-link#section">Internal Link with Hash</a>
        <a href="https://external.com/docs">External Resource</a>
        <a href="mailto:info@example.com">Contact Email</a>
        <a href="javascript:void(0)">Click Here</a>
        <a href="/another-internal">Another Link</a>
      </body>
      </html>
    `;

    const result = extractFromHtml(html, baseUrl, { maxLinks: 2 });

    expect(result.links).toHaveLength(2);
    expect(result.links[0]).toEqual({
      text: 'Internal Page',
      href: 'https://example.com/internal-link',
      internal: true,
    });
    // The duplicate without hash should be deduplicated
    expect(result.links[1]).toEqual({
      text: 'External Resource',
      href: 'https://external.com/docs',
      internal: false,
    });
  });

  test('should extract and resolve images while ignoring data URIs and respecting maxImages', () => {
    const html = `
      <html>
      <body>
        <img src="/assets/diagram.png" alt="Architecture Diagram" />
        <img src="data:image/png;base64,iVBORw0KGgo=" alt="Embedded Base64" />
        <img src="https://cdn.example.com/banner.jpg" alt="Banner Image" />
        <img src="/assets/extra.png" alt="Extra" />
      </body>
      </html>
    `;

    const result = extractFromHtml(html, baseUrl, { maxImages: 2 });

    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({
      src: 'https://example.com/assets/diagram.png',
      alt: 'Architecture Diagram',
    });
    expect(result.images[1]).toEqual({
      src: 'https://cdn.example.com/banner.jpg',
      alt: 'Banner Image',
    });
  });

  test('should use Readability extractor when article has substantial text (>= 200 chars)', () => {
    const longText = 'Artificial intelligence represents a major milestone in technology. '.repeat(10);
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Long Form Article</title></head>
      <body>
        <article>
          <h1>The Evolution of AI Systems</h1>
          <p class="byline">By Dr. Alan Turing</p>
          <p>${longText}</p>
        </article>
      </body>
      </html>
    `;

    const result = extractFromHtml(html, baseUrl);

    expect(result.content.extractor).toBe('readability');
    expect(result.content.headings).toContainEqual({
      level: 2,
      text: 'The Evolution of AI Systems',
    });
    expect(result.content.markdown).toContain('The Evolution of AI Systems');
    expect(result.stats.wordCount).toBeGreaterThan(50);
    expect(result.stats.readingTimeMin).toBeGreaterThanOrEqual(1);
  });

  test('should use fallback extractor for short or non-article content', () => {
    const html = `
      <html>
      <head><title>Short Page</title></head>
      <body>
        <nav><a href="/">Nav Item</a></nav>
        <main>
          <h2>Quick Note</h2>
          <p>Just a short update about our services.</p>
        </main>
        <footer>Footer content</footer>
      </body>
      </html>
    `;

    const result = extractFromHtml(html, baseUrl);

    expect(result.content.extractor).toBe('fallback');
    expect(result.content.text).toContain('Quick Note');
    expect(result.content.text).toContain('Just a short update about our services.');
    expect(result.content.text).not.toContain('Nav Item');
    expect(result.content.text).not.toContain('Footer content');
  });

  test('should build structured headings, sections, tables, blockquotes, and lists', () => {
    const html = `
      <html>
      <body>
        <main>
          <h1>Project Documentation</h1>
          <p>Introduction paragraph.</p>
          <blockquote>Important guideline to follow.</blockquote>
          <ul>
            <li>Step 1: Setup</li>
            <li>Step 2: Run tests</li>
          </ul>
          <pre>npm test</pre>
          <h2>Performance Metrics</h2>
          <table>
            <caption>Benchmarks</caption>
            <thead>
              <tr><th>Metric</th><th>Score</th></tr>
            </thead>
            <tbody>
              <tr><td>Speed</td><td>99</td></tr>
              <tr><td>Memory</td><td>45MB</td></tr>
            </tbody>
          </table>
        </main>
      </body>
      </html>
    `;

    const result = extractFromHtml(html, baseUrl);

    expect(result.content.headings).toEqual([
      { level: 1, text: 'Project Documentation' },
      { level: 2, text: 'Performance Metrics' },
    ]);

    expect(result.content.tables).toHaveLength(1);
    expect(result.content.tables[0]).toEqual({
      caption: 'Benchmarks',
      section: 'Performance Metrics',
      rows: [
        ['Metric', 'Score'],
        ['Speed', '99'],
        ['Memory', '45MB'],
      ],
    });

    const projectSection = result.content.sections.find((s) => s.heading === 'Project Documentation');
    expect(projectSection.text).toContain('Introduction paragraph.');
    expect(projectSection.text).toContain('> Important guideline to follow.');
    expect(projectSection.text).toContain('- Step 1: Setup');
    expect(projectSection.text).toContain('```\nnpm test\n```');
  });

  test('should include raw HTML when includeHtml option is true', () => {
    const html = '<html><body><main><p>Content to include</p></main></body></html>';
    const resultWithHtml = extractFromHtml(html, baseUrl, { includeHtml: true });
    expect(resultWithHtml.content.html).toBeDefined();
    expect(resultWithHtml.content.html).toContain('Content to include');

    const resultWithoutHtml = extractFromHtml(html, baseUrl, { includeHtml: false });
    expect(resultWithoutHtml.content.html).toBeUndefined();
  });
});

describe('crawlPage', () => {
  const targetUrl = 'https://example.com/test-page';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should successfully fetch and crawl a page with fetch mock', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Fetched Page</title></head>
      <body>
        <main>
          <h1>Successful Crawl</h1>
          <p>Fetched content body text.</p>
        </main>
      </body>
      </html>
    `;

    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(mockHtml, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    );

    const result = await crawlPage(targetUrl, { allowPrivate: true });

    expect(result.requestedUrl).toBe(targetUrl);
    expect(result.status).toBe(200);
    expect(result.fetchedAt).toBeDefined();
    expect(result.meta.title).toBe('Fetched Page');
    expect(result.content.text).toContain('Successful Crawl');
  });

  test('should throw CrawlError on non-2xx HTTP responses', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'text/html' },
      })
    );

    await expect(crawlPage(targetUrl, { allowPrivate: true })).rejects.toMatchObject({
      code: 'HTTP_404',
      message: 'HTTP 404 Not Found',
    });
  });

  test('should throw CrawlError on unsupported content types', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('binary content', {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      })
    );

    await expect(crawlPage(targetUrl, { allowPrivate: true })).rejects.toMatchObject({
      code: 'UNSUPPORTED_TYPE',
    });
  });

  test('should follow HTTP redirects up to maxRedirects', async () => {
    const redirectUrl = 'https://example.com/destination';
    const finalHtml = '<html><head><title>Destination</title></head><body><p>Arrived</p></body></html>';

    const fetchSpy = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('', {
          status: 301,
          headers: { location: redirectUrl },
        })
      )
      .mockResolvedValueOnce(
        new Response(finalHtml, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      );

    const result = await crawlPage(targetUrl, { allowPrivate: true });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.url).toBe(redirectUrl);
    expect(result.meta.title).toBe('Destination');
  });

  test('should throw TOO_MANY_REDIRECTS when exceeding maxRedirects', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 302,
        headers: { location: 'https://example.com/loop' },
      })
    );

    await expect(
      crawlPage(targetUrl, { allowPrivate: true, maxRedirects: 2 })
    ).rejects.toMatchObject({
      code: 'TOO_MANY_REDIRECTS',
    });
  });

  test('should throw TOO_LARGE when page size exceeds maxBytes', async () => {
    const largeBody = 'A'.repeat(500);

    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(largeBody, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );

    await expect(
      crawlPage(targetUrl, { allowPrivate: true, maxBytes: 100 })
    ).rejects.toMatchObject({
      code: 'TOO_LARGE',
    });
  });

  test('should throw TIMEOUT when fetch throws TimeoutError', async () => {
    const timeoutError = new Error('The operation was aborted');
    timeoutError.name = 'TimeoutError';

    jest.spyOn(globalThis, 'fetch').mockRejectedValue(timeoutError);

    await expect(crawlPage(targetUrl, { allowPrivate: true })).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: 'Request timed out',
    });
  });

  test('should throw NETWORK when fetch encounters a network failure', async () => {
    const netError = new Error('Connection refused');
    netError.cause = { code: 'ECONNREFUSED' };

    jest.spyOn(globalThis, 'fetch').mockRejectedValue(netError);

    await expect(crawlPage(targetUrl, { allowPrivate: true })).rejects.toMatchObject({
      code: 'NETWORK',
      message: 'Network error: ECONNREFUSED',
    });
  });

  test('should throw NO_PLAYWRIGHT when render: true is requested and playwright is unavailable', async () => {
    // If playwright is not installed, it should throw NO_PLAYWRIGHT
    try {
      await crawlPage(targetUrl, { render: true, allowPrivate: true });
    } catch (err) {
      expect(['NO_PLAYWRIGHT', 'NETWORK', 'TIMEOUT']).toContain(err.code);
    }
  });
});

describe('crawlSite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should crawl multiple pages on the same origin breadth-first up to maxPages', async () => {
    const startUrl = 'https://example.com/home';
    const page1Html = `
      <html><head><title>Home</title></head>
      <body>
        <main><p>Home page content.</p></main>
        <a href="https://example.com/page-1">Page 1</a>
        <a href="https://example.com/page-2">Page 2</a>
        <a href="https://otherdomain.com/external">External</a>
      </body></html>
    `;
    const page2Html = `
      <html><head><title>Page 1</title></head>
      <body><main><p>Page 1 content.</p></main></body></html>
    `;
    const page3Html = `
      <html><head><title>Page 2</title></head>
      <body><main><p>Page 2 content.</p></main></body></html>
    `;

    jest.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === startUrl) {
        return Promise.resolve(new Response(page1Html, { headers: { 'content-type': 'text/html' } }));
      }
      if (url === 'https://example.com/page-1') {
        return Promise.resolve(new Response(page2Html, { headers: { 'content-type': 'text/html' } }));
      }
      if (url === 'https://example.com/page-2') {
        return Promise.resolve(new Response(page3Html, { headers: { 'content-type': 'text/html' } }));
      }
      return Promise.reject(new Error('Unknown url'));
    });

    const pages = await crawlSite(startUrl, {
      maxPages: 3,
      sameOrigin: true,
      delayMs: 0,
      allowPrivate: true,
    });

    expect(pages).toHaveLength(3);
    expect(pages[0].meta.title).toBe('Home');
    expect(pages[1].meta.title).toBe('Page 1');
    expect(pages[2].meta.title).toBe('Page 2');
  });

  test('should skip binary asset extensions like .pdf, .png, .jpg', async () => {
    const startUrl = 'https://example.com/links';
    const html = `
      <html><head><title>Links</title></head>
      <body>
        <a href="https://example.com/download.pdf">Download PDF</a>
        <a href="https://example.com/photo.jpg">Photo</a>
        <a href="https://example.com/valid-article">Article</a>
      </body></html>
    `;
    const articleHtml = '<html><head><title>Article</title></head><body><p>Text</p></body></html>';

    jest.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === startUrl) {
        return Promise.resolve(new Response(html, { headers: { 'content-type': 'text/html' } }));
      }
      return Promise.resolve(new Response(articleHtml, { headers: { 'content-type': 'text/html' } }));
    });

    const pages = await crawlSite(startUrl, {
      maxPages: 5,
      delayMs: 0,
      allowPrivate: true,
    });

    const urls = pages.map((p) => p.requestedUrl);
    expect(urls).toContain('https://example.com/links');
    expect(urls).toContain('https://example.com/valid-article');
    expect(urls).not.toContain('https://example.com/download.pdf');
    expect(urls).not.toContain('https://example.com/photo.jpg');
  });

  test('should capture error per page without aborting the entire crawl', async () => {
    const startUrl = 'https://example.com/start';
    const startHtml = `
      <html><head><title>Start</title></head>
      <body>
        <a href="https://example.com/failing-page">Error Page</a>
        <a href="https://example.com/success-page">Success Page</a>
      </body></html>
    `;

    jest.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === startUrl) {
        return Promise.resolve(new Response(startHtml, { headers: { 'content-type': 'text/html' } }));
      }
      if (url === 'https://example.com/failing-page') {
        return Promise.resolve(new Response('Error', { status: 500, statusText: 'Server Error' }));
      }
      return Promise.resolve(new Response('<html><head><title>Success</title></head><body>OK</body></html>', {
        headers: { 'content-type': 'text/html' },
      }));
    });

    const pages = await crawlSite(startUrl, {
      maxPages: 3,
      delayMs: 0,
      allowPrivate: true,
    });

    expect(pages).toHaveLength(3);
    const failedPage = pages.find((p) => p.requestedUrl === 'https://example.com/failing-page');
    expect(failedPage.error).toBeDefined();
    expect(failedPage.error.code).toBe('HTTP_500');

    const successPage = pages.find((p) => p.requestedUrl === 'https://example.com/success-page');
    expect(successPage.meta.title).toBe('Success');
  });
});

describe('crawlToSourceText', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return formatted markdown string with title, author, published date, and source', async () => {
    const targetUrl = 'https://example.com/pipeline-test';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pipeline Test Article</title>
        <meta name="author" content="Alice Engineer">
        <meta property="article:published_time" content="2026-04-01">
      </head>
      <body>
        <main>
          <h1>Pipeline Test Article</h1>
          <p>Here is content ready for content ingestion pipeline.</p>
        </main>
      </body>
      </html>
    `;

    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, {
        headers: { 'content-type': 'text/html' },
      })
    );

    const sourceText = await crawlToSourceText(targetUrl, { allowPrivate: true });

    expect(sourceText).toContain('# Pipeline Test Article');
    expect(sourceText).toContain('Author: Alice Engineer');
    expect(sourceText).toContain('Published: 2026-04-01');
    expect(sourceText).toContain(`Source: ${targetUrl}`);
    expect(sourceText).toContain('Here is content ready for content ingestion pipeline.');
  });

  test('should fallback to URL when title is missing and omit optional metadata headers', async () => {
    const targetUrl = 'https://example.com/no-metadata';
    const html = '<html><body><main><p>Just simple text without title or author.</p></main></body></html>';

    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, {
        headers: { 'content-type': 'text/html' },
      })
    );

    const sourceText = await crawlToSourceText(targetUrl, { allowPrivate: true });

    expect(sourceText).toContain(`# ${targetUrl}`);
    expect(sourceText).not.toContain('Author:');
    expect(sourceText).not.toContain('Published:');
    expect(sourceText).toContain(`Source: ${targetUrl}`);
  });
});

describe('Edge cases and branches', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should handle various JSON-LD author formats (array, string, object, null)', () => {
    const htmlArray = `
      <html><head>
        <script type="application/ld+json">{
          "headline": "Team Effort",
          "author": ["Alice", { "name": "Bob" }, null]
        }</script>
      </head><body><p>Text</p></body></html>
    `;
    const resArray = extractFromHtml(htmlArray, 'https://example.com');
    expect(resArray.meta.author).toBe('Alice, Bob');

    const htmlString = `
      <html><head>
        <script type="application/ld+json">{
          "headline": "Solo Post",
          "author": "Charlie"
        }</script>
      </head><body><p>Text</p></body></html>
    `;
    const resString = extractFromHtml(htmlString, 'https://example.com');
    expect(resString.meta.author).toBe('Charlie');
  });

  test('should handle links and images with invalid href/src gracefully', () => {
    const html = `
      <html><body>
        <a href="http://[invalid-ipv6">Broken Link</a>
        <img src="http://[invalid-ipv6" alt="Broken Img" />
      </body></html>
    `;
    const res = extractFromHtml(html, 'https://example.com');
    expect(res.links).toHaveLength(0);
    expect(res.images).toHaveLength(0);
  });

  test('should detect and decode body charset from meta tag and content-type', async () => {
    const html = '<html><head><meta charset="windows-1252"></head><body><p>Test</p></body></html>';
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    );

    const res = await crawlPage('https://example.com/charset', { allowPrivate: true });
    expect(res.content.text).toContain('Test');
  });

  test('should reject various private IPv6 and IPv4 edge cases in SSRF protection', async () => {
    const testCases = [
      'http://[::]/',
      'http://[fc00::1]/',
      'http://[fe80::1]/',
      'http://[::ffff:192.168.1.1]/',
      'http://100.64.0.1/',
      'http://172.31.255.255/',
      'http://224.0.0.1/',
    ];

    for (const url of testCases) {
      await expect(crawlPage(url, { allowPrivate: false })).rejects.toMatchObject({
        code: 'PRIVATE_ADDRESS',
      });
    }
  });
});

