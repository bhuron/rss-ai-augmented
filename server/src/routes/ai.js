import express from 'express';
import { articleOps, settingsOps } from '../services/database.js';
import { sortArticles, generateDigest } from '../services/ai.js';

const router = express.Router();

function getLLMConfig() {
  const settings = settingsOps.getAll('llm_');
  const config = {};
  
  Object.keys(settings).forEach(key => {
    const configKey = key.replace('llm_', '');
    config[configKey] = settings[key];
  });

  return config;
}

router.post('/sort', async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

router.post('/digest', async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

export default router;
