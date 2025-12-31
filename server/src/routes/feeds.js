import express from 'express';
import { feedOps } from '../services/database.js';
import { fetchFeed, syncFeed } from '../services/rss.js';
import { validateFeedUrl } from '../services/url-validator.js';

const router = express.Router();

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

router.post('/:id/sync', async (req, res) => {
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
    // Simple OPML parser
    const urlMatches = opml.matchAll(/xmlUrl="([^"]+)"/g);
    const titleMatches = opml.matchAll(/text="([^"]+)"/g);

    const urls = Array.from(urlMatches).map(m => m[1]);
    const titles = Array.from(titleMatches).map(m => m[1]);

    let imported = 0;
    let failed = 0;
    let blocked = 0;

    for (let i = 0; i < urls.length; i++) {
      try {
        const existingFeed = feedOps.all().find(f => f.url === urls[i]);
        if (!existingFeed) {
          // Validate URL to prevent SSRF attacks
          const validation = await validateFeedUrl(urls[i]);
          if (!validation.safe) {
            console.log(`[Security] Blocked feed import: ${urls[i]} (${validation.reason})`);
            blocked++;
            failed++;
            continue;
          }

          if (validation.warning) {
            console.log(`[Warning] Importing feed with ${validation.warning}: ${urls[i]}`);
          }

          const feed = await fetchFeed(urls[i]);
          const newFeed = feedOps.insert(feed.title || titles[i], urls[i]);
          await syncFeed(newFeed.id, urls[i]);
          imported++;
        }
      } catch (error) {
        console.error(`Failed to import ${urls[i]}:`, error.message);
        failed++;
      }
    }

    res.json({ imported, failed, blocked, total: urls.length });
  } catch (error) {
    // Don't leak detailed error messages
    console.error('Import error:', error);
    res.status(400).json({ error: 'Failed to import feeds. Please check the OPML format.' });
  }
});

router.post('/sync-all', async (req, res) => {
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
