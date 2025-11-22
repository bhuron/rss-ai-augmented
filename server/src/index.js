import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import basicAuth from 'express-basic-auth';
import { initDatabase, articleOps } from './services/database.js';
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

// Basic authentication
if (process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASSWORD) {
  app.use(basicAuth({
    users: { [process.env.BASIC_AUTH_USER]: process.env.BASIC_AUTH_PASSWORD },
    challenge: true,
    realm: 'RSS + LLM Reader'
  }));
  console.log('Basic authentication enabled');
}

// Initialize database
initDatabase();

// Clean up old articles on startup
articleOps.cleanup();

// Clean up old articles daily
setInterval(() => {
  articleOps.cleanup();
}, 24 * 60 * 60 * 1000); // Every 24 hours

// Routes
app.use('/api/feeds', feedRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
