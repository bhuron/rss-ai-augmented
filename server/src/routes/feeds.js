import express from 'express';
import { feedOps } from '../services/database.js';
import { fetchFeed, syncFeed } from '../services/rss.js';

const router = express.Router();

router.get('/', (req, res) => {
  const feeds = feedOps.all();
  res.json(feeds);
});

router.post('/', async (req, res) => {
  const { url } = req.body;
  
  try {
    const feed = await fetchFeed(url);
    const newFeed = feedOps.insert(feed.title, url);
    
    await syncFeed(newFeed.id, url);
    
    res.json(newFeed);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
  
  try {
    const result = await syncFeed(feed.id, feed.url);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
  
  try {
    // Simple OPML parser
    const urlMatches = opml.matchAll(/xmlUrl="([^"]+)"/g);
    const titleMatches = opml.matchAll(/text="([^"]+)"/g);
    
    const urls = Array.from(urlMatches).map(m => m[1]);
    const titles = Array.from(titleMatches).map(m => m[1]);
    
    let imported = 0;
    let failed = 0;
    
    for (let i = 0; i < urls.length; i++) {
      try {
        const existingFeed = feedOps.all().find(f => f.url === urls[i]);
        if (!existingFeed) {
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
    
    res.json({ imported, failed, total: urls.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/sync-all', async (req, res) => {
  const feeds = feedOps.all();
  let synced = 0;
  let failed = 0;
  
  console.log(`Syncing ${feeds.length} feeds...`);
  
  for (const feed of feeds) {
    try {
      await syncFeed(feed.id, feed.url);
      synced++;
    } catch (error) {
      console.error(`Failed to sync ${feed.title}:`, error.message);
      failed++;
    }
  }
  
  console.log(`Sync complete: ${synced} succeeded, ${failed} failed`);
  res.json({ synced, failed, total: feeds.length });
});

export default router;
