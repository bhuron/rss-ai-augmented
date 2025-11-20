import express from 'express';
import { settingsOps } from '../services/database.js';

const router = express.Router();

router.get('/llm', (req, res) => {
  const settings = settingsOps.getAll('llm_');
  
  const config = {};
  Object.keys(settings).forEach(key => {
    const configKey = key.replace('llm_', '');
    config[configKey] = settings[key];
  });

  res.json(config);
});

router.post('/llm', (req, res) => {
  const { provider, apiKey, baseUrl, model } = req.body;
  
  settingsOps.set('llm_provider', provider);
  settingsOps.set('llm_apiKey', apiKey);
  settingsOps.set('llm_baseUrl', baseUrl || '');
  settingsOps.set('llm_model', model);

  res.json({ success: true });
});

export default router;
