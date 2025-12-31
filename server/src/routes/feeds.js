import express from 'express';
import rateLimit from 'express-rate-limit';
import { feedOps } from '../services/database.js';
import { fetchFeed, syncFeed } from '../services/rss.js';
import { validateFeedUrl } from '../services/url-validator.js';
import { XMLParser } from 'fast-xml-parser';

const router = express.Router();

// Rate limiter for sync endpoints to prevent abuse and resource exhaustion
// Allow 1 sync request per minute per IP address
const syncRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1,
  message: { error: 'Too many sync requests. Please wait before syncing again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', (req, res) => {
  const feeds = feedOps.all();
  res.json(feeds);
});

router.post('/', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // Validate URL to prevent SSRF attacks
  const validation = await validateFeedUrl(url);
  if (!validation.safe) {
    console.log(`[Security] Blocked feed addition: ${url} (${validation.reason})`);
    return res.status(403).json({ error: 'Invalid or blocked URL' });
  }

  if (validation.warning) {
    console.log(`[Warning] Adding feed with ${validation.warning}: ${url}`);
  }

  try {
    const feed = await fetchFeed(url);
    // Fallback to URL hostname if title is empty
    const title = feed.title?.trim() || new URL(url).hostname;
    const newFeed = feedOps.insert(title, url);

    await syncFeed(newFeed.id, url);

    res.json(newFeed);
  } catch (error) {
    // Don't leak detailed error messages
    console.error(`Failed to add feed ${url}:`, error.message);
    res.status(400).json({ error: 'Failed to fetch feed. Please check the URL and try again.' });
  }
});

router.delete('/:id', (req, res) => {
  feedOps.delete(parseInt(req.params.id));
  res.json({ success: true });
});

router.patch('/:id', (req, res) => {
  const { title } = req.body;
  const feed = feedOps.get(parseInt(req.params.id));
  
  if (!feed) {
    return res.status(404).json({ error: 'Feed not found' });
  }
  
  feedOps.update(parseInt(req.params.id), title);
  res.json({ success: true });
});

router.post('/:id/sync', syncRateLimiter, async (req, res) => {
  const feed = feedOps.get(parseInt(req.params.id));

  if (!feed) {
    return res.status(404).json({ error: 'Feed not found' });
  }

  try {
    const result = await syncFeed(feed.id, feed.url);
    res.json(result);
  } catch (error) {
    // Don't leak detailed error messages
    console.error(`Failed to sync feed ${feed.url}:`, error.message);
    res.status(400).json({ error: 'Failed to sync feed. Please try again later.' });
  }
});

router.get('/export', (req, res) => {
  const feeds = feedOps.all();
  
  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS Feeds Export</title>
  </head>
  <body>
${feeds.map(feed => `    <outline type="rss" text="${feed.title}" xmlUrl="${feed.url}"/>`).join('\n')}
  </body>
</opml>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="feeds.opml"');
  res.send(opml);
});

router.post('/import', async (req, res) => {
  const { opml } = req.body;

  if (!opml) {
    return res.status(400).json({ error: 'OPML data is required' });
  }

  try {
    // Configure XML parser with security options to prevent XXE attacks
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      // Security: Prevent XXE (XML External Entity) attacks
      allowBooleanAttributes: false,
      parseTagValue: false,
      parseAttributeValue: false,
      trimValues: true,
      // Don't process entities
      processEntities: false,
      // Stop parsing at first error to prevent complex attack payloads
      stopNodes: ['script', 'style'],
      ignoreDeclaration: true,
      ignorePiTags: true
    });

    // Parse OPML XML
    const parsedData = parser.parse(opml);

    // Extract feeds from parsed OPML structure
    // Handle both OPML 1.0 and 2.0 formats
    const body = parsedData.opml?.body || parsedData.body;
    if (!body) {
      return res.status(400).json({ error: 'Invalid OPML format: missing body element' });
    }

    // Extract outlines (feeds) - can be array or nested object
    const extractOutlines = (element) => {
      const outlines = [];

      if (Array.isArray(element.outline)) {
        outlines.push(...element.outline);
      } else if (element.outline) {
        outlines.push(element.outline);
      }

      // Recursively extract nested outlines
      for (const key in element) {
        if (typeof element[key] === 'object' && key !== 'outline') {
          outlines.push(...extractOutlines(element[key]));
        }
      }

      return outlines;
    };

    const feeds = extractOutlines(body).filter(item => item.xmlUrl);

    let imported = 0;
    let failed = 0;
    let blocked = 0;

    for (const feed of feeds) {
      try {
        const url = feed.xmlUrl;
        const title = feed.text || feed.title;

        if (!url) {
          failed++;
          continue;
        }

        const existingFeed = feedOps.all().find(f => f.url === url);
        if (!existingFeed) {
          // Validate URL to prevent SSRF attacks
          const validation = await validateFeedUrl(url);
          if (!validation.safe) {
            console.log(`[Security] Blocked feed import: ${url} (${validation.reason})`);
            blocked++;
            failed++;
            continue;
          }

          if (validation.warning) {
            console.log(`[Warning] Importing feed with ${validation.warning}: ${url}`);
          }

          const feedData = await fetchFeed(url);
          const newFeed = feedOps.insert(feedData.title || title, url);
          await syncFeed(newFeed.id, url);
          imported++;
        }
      } catch (error) {
        console.error(`Failed to import feed:`, error.message);
        failed++;
      }
    }

    res.json({ imported, failed, blocked, total: feeds.length });
  } catch (error) {
    // Don't leak detailed error messages
    console.error('Import error:', error);
    res.status(400).json({ error: 'Failed to import feeds. Please check the OPML format.' });
  }
});

router.post('/sync-all', syncRateLimiter, async (req, res) => {
  const feeds = feedOps.all();
  
  console.log(`Syncing ${feeds.length} feeds in parallel...`);
  
  // Set response headers for streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  let synced = 0;
  let failed = 0;
  let completed = 0;
  
  // Sync all feeds in parallel with timeout
  const syncPromises = feeds.map(async (feed) => {
    try {
      // Add 15 second timeout per feed
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 15000)
      );
      
      await Promise.race([
        syncFeed(feed.id, feed.url),
        timeoutPromise
      ]);
      
      synced++;
      completed++;
      
      // Send progress update
      res.write(JSON.stringify({ 
        type: 'progress', 
        synced, 
        failed, 
        completed,
        total: feeds.length 
      }) + '\n');
      
    } catch (error) {
      failed++;
      completed++;
      console.error(`Failed to sync ${feed.title}:`, error.message);
      
      // Send progress update
      res.write(JSON.stringify({ 
        type: 'progress', 
        synced, 
        failed, 
        completed,
        total: feeds.length 
      }) + '\n');
    }
  });
  
  await Promise.all(syncPromises);
  
  console.log(`Sync complete: ${synced} succeeded, ${failed} failed`);
  
  // Send final result
  res.write(JSON.stringify({ 
    type: 'complete',
    synced, 
    failed, 
    total: feeds.length 
  }) + '\n');
  
  res.end();
});

export default router;
