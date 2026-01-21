import express from 'express';
import rateLimit from 'express-rate-limit';
import { articleOps, settingsOps } from '../services/database.js';
import { sortArticles, generateDigest } from '../services/ai.js';
import { validateBody, asyncHandler } from '../middleware/validate.js';
import {
  AISortRequestSchema,
  AIDigestRequestSchema
} from '../schemas/api.js';

const router = express.Router();

// Rate limiter for AI endpoints to prevent API credit drainage
// Allow 10 requests per 15 minutes per IP address
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many AI requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function getLLMConfig() {
  const settings = settingsOps.getAll('llm_');
  const config = {};
  
  Object.keys(settings).forEach(key => {
    const configKey = key.replace('llm_', '');
    config[configKey] = settings[key];
  });

  return config;
}

router.post('/sort',
  validateBody(AISortRequestSchema),
  aiRateLimiter,
  asyncHandler(async (req, res) => {
  const { articleIds, criteria } = req.body;
  
  try {
    const config = getLLMConfig();
    
    if (!config.provider || !config.model) {
      return res.status(400).json({ error: 'LLM not configured. Please configure in Settings.' });
    }
    
    if (config.provider !== 'ollama' && !config.apiKey) {
      return res.status(400).json({ error: 'API key not configured. Please add your API key in Settings.' });
    }
    
    const articles = articleOps.getByIds(articleIds);
    
    if (!articles || articles.length === 0) {
      return res.status(400).json({ error: 'No articles found' });
    }
    
    console.log(`Sorting ${articles.length} articles with ${config.provider}...`);
    const result = await sortArticles(config, articles, criteria);
    console.log('Sort complete');
    
    res.json(result);
  } catch (error) {
    console.error('Sort error:', error);
    throw error; // asyncHandler will catch this
  }
}));

router.post('/digest',
  validateBody(AIDigestRequestSchema),
  aiRateLimiter,
  asyncHandler(async (req, res) => {
  const { articleIds } = req.body;
  
  try {
    const config = getLLMConfig();
    
    if (!config.provider || !config.model) {
      return res.status(400).json({ error: 'LLM not configured. Please configure in Settings.' });
    }
    
    if (config.provider !== 'ollama' && !config.apiKey) {
      return res.status(400).json({ error: 'API key not configured. Please add your API key in Settings.' });
    }
    
    const articles = articleOps.getByIds(articleIds);
    
    if (!articles || articles.length === 0) {
      return res.status(400).json({ error: 'No articles found' });
    }
    
    console.log(`Generating digest for ${articles.length} articles with ${config.provider}...`);
    const digest = await generateDigest(config, articles);
    console.log('Digest complete');
    
    res.json({ digest });
  } catch (error) {
    console.error('Digest error:', error);
    throw error; // asyncHandler will catch this
  }
}));

export default router;
