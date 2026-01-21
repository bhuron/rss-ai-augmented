import express from 'express';
import { settingsOps } from '../services/database.js';
import { validateBody } from '../middleware/validate.js';
import { UpdateLLMSettingsRequestSchema } from '../schemas/api.js';

const router = express.Router();

router.get('/llm', (req, res) => {
  const settings = settingsOps.getAll('llm_');

  const config = {};
  Object.keys(settings).forEach(key => {
    const configKey = key.replace('llm_', '');

    // Security: Never return full API key - return masked version
    if (configKey === 'apiKey') {
      const apiKeyValue = settings[key];
      config[configKey] = apiKeyValue ? `${apiKeyValue.slice(0, 7)}...${apiKeyValue.slice(-4)}` : '';
    } else {
      config[configKey] = settings[key];
    }
  });

  res.json(config);
});

router.post('/llm', validateBody(UpdateLLMSettingsRequestSchema), (req, res) => {
  const { provider, apiKey, baseUrl, model } = req.body;
  
  settingsOps.set('llm_provider', provider);
  settingsOps.set('llm_apiKey', apiKey);
  settingsOps.set('llm_baseUrl', baseUrl || '');
  settingsOps.set('llm_model', model);

  res.json({ success: true });
});

export default router;
