import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import { initDatabase, articleOps } from './services/database.js';
import feedRoutes from './routes/feeds.js';
import articleRoutes from './routes/articles.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));
app.use(express.json({ charset: 'utf-8' }));
app.use(express.urlencoded({ extended: true, charset: 'utf-8' }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

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
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': new URL(url).origin
      }
    });
    
    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch image');
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
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
app.use('/api/auth', authRoutes);
app.use('/api/feeds', feedRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
