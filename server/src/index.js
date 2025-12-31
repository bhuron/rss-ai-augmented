import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase, articleOps } from './services/database.js';
import { validateUrl, cleanCache } from './services/url-validator.js';
import feedRoutes from './routes/feeds.js';
import articleRoutes from './routes/articles.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Set default charset for responses
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Initialize database
initDatabase();

// Clean up old articles on startup
articleOps.cleanup();

// Clean up old articles daily
setInterval(() => {
  articleOps.cleanup();
}, 24 * 60 * 60 * 1000); // Every 24 hours

// Clean up DNS cache periodically (every hour)
setInterval(() => {
  cleanCache();
}, 60 * 60 * 1000);

// Image proxy to bypass CORS/hotlinking restrictions
app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  // Skip relative URLs silently
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return res.status(404).send('Not found');
  }

  // Validate URL to prevent SSRF attacks
  const validation = await validateUrl(url);
  if (!validation.safe) {
    console.log(`[Security] Blocked image proxy request: ${url} (${validation.reason})`);
    return res.status(403).send('Forbidden');
  }

  try {
    // Add timeout to prevent hanging (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(url).origin
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch image');
    }

    const contentType = response.headers.get('content-type');

    // Security: Validate Content-Type to prevent proxying non-image content
    // Allow all common image types (includes variations like image/jpeg, image/png, etc.)
    if (!contentType || !contentType.startsWith('image/')) {
      console.log(`[Security] Blocked non-image content: ${url} (Content-Type: ${contentType})`);
      return res.status(403).send('Forbidden: Not an image');
    }

    res.setHeader('Content-Type', contentType);

    // Cache for 1 day
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    // Silently fail - image will just not display
    res.status(500).send('Failed to proxy image');
  }
});

// Routes
app.use('/api/feeds', feedRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
