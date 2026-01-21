import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import settingsRouter from '../../../src/routes/settings.js';
import { settingsOps } from '../../../src/services/database.js';

// Mock database service
vi.mock('../../../src/services/database.js');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/settings', settingsRouter);

// Helper function to create getAll mock
const mockGetAll = (settings) => {
  settingsOps.getAll.mockImplementation((prefix) => {
    return Object.keys(settings)
      .filter(key => key.startsWith(prefix))
      .reduce((obj, key) => {
        obj[key] = settings[key];
        return obj;
      }, {});
  });
};

describe('Settings API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll({});
    settingsOps.set.mockReturnValue(undefined);
  });

  describe('GET /api/settings/llm', () => {
    it('should return LLM configuration with masked API key', async () => {
      mockGetAll({
        llm_provider: 'openai',
        llm_apiKey: 'sk-1234567890abcdef1234567890abcdef',
        llm_model: 'gpt-4',
        llm_baseUrl: ''
      });

      const response = await request(app).get('/api/settings/llm');

      expect(response.status).toBe(200);
      expect(response.body.provider).toBe('openai');
      expect(response.body.model).toBe('gpt-4');
      expect(response.body.apiKey).toBe('sk-12345...cdef');
      expect(response.body.baseUrl).toBe('');
    });

    it('should handle empty API key', async () => {
      mockGetAll({
        llm_provider: 'openai',
        llm_apiKey: '',
        llm_model: 'gpt-4'
      });

      const response = await request(app).get('/api/settings/llm');

      expect(response.status).toBe(200);
      expect(response.body.apiKey).toBe('');
    });

    it('should handle missing API key', async () => {
      mockGetAll({
        llm_provider: 'ollama',
        llm_model: 'llama2'
      });

      const response = await request(app).get('/api/settings/llm');

      expect(response.status).toBe(200);
      expect(response.body.apiKey).toBeUndefined();
    });

    it('should handle empty settings', async () => {
      const response = await request(app).get('/api/settings/llm');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({});
    });

    it('should only return llm_ prefixed settings', async () => {
      mockGetAll({
        llm_provider: 'openai',
        llm_apiKey: 'sk-key',
        llm_model: 'gpt-4',
        some_other_setting: 'should not appear'
      });

      const response = await request(app).get('/api/settings/llm');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('provider');
      expect(response.body).toHaveProperty('apiKey');
      expect(response.body).toHaveProperty('model');
      expect(response.body).not.toHaveProperty('some_other_setting');
    });

    it('should correctly mask short API keys', async () => {
      mockGetAll({
        llm_provider: 'openai',
        llm_apiKey: 'sk-short',
        llm_model: 'gpt-4'
      });

      const response = await request(app).get('/api/settings/llm');

      expect(response.status).toBe(200);
      // For short keys like "sk-short" (8 chars):
      // First 7 chars: "sk-shor"
      // Last 4 chars: "hort"
      // Result: "sk-shor...hort"
      expect(response.body.apiKey).toBe('sk-shor...hort');
    });

    it('should handle baseUrl parameter', async () => {
      mockGetAll({
        llm_provider: 'openai',
        llm_apiKey: 'sk-1234567890abcdef1234567890abcdef',
        llm_model: 'gpt-4',
        llm_baseUrl: 'https://api.openai.com/v1'
      });

      const response = await request(app).get('/api/settings/llm');

      expect(response.status).toBe(200);
      expect(response.body.baseUrl).toBe('https://api.openai.com/v1');
    });
  });

  describe('POST /api/settings/llm', () => {
    it('should save LLM configuration', async () => {
      const config = {
        provider: 'openai',
        apiKey: 'sk-1234567890abcdef1234567890abcdef',
        model: 'gpt-4',
        baseUrl: 'https://api.openai.com/v1'
      };

      const response = await request(app)
        .post('/api/settings/llm')
        .send(config);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(settingsOps.set).toHaveBeenCalledWith('llm_provider', 'openai');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_apiKey', 'sk-1234567890abcdef1234567890abcdef');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_baseUrl', 'https://api.openai.com/v1');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_model', 'gpt-4');
    });

    it('should save configuration without baseUrl', async () => {
      const config = {
        provider: 'openai',
        apiKey: 'sk-key',
        model: 'gpt-4'
      };

      const response = await request(app)
        .post('/api/settings/llm')
        .send(config);

      expect(response.status).toBe(200);
      expect(settingsOps.set).toHaveBeenCalledWith('llm_baseUrl', '');
    });

    it('should handle ollama provider (no API key required)', async () => {
      const config = {
        provider: 'ollama',
        apiKey: '',
        model: 'llama2'
      };

      const response = await request(app)
        .post('/api/settings/llm')
        .send(config);

      expect(response.status).toBe(200);
      expect(settingsOps.set).toHaveBeenCalledWith('llm_provider', 'ollama');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_apiKey', '');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_model', 'llama2');
    });

    it('should handle anthropic provider', async () => {
      const config = {
        provider: 'anthropic',
        apiKey: 'sk-ant-key',
        model: 'claude-3-opus-20240229',
        baseUrl: ''
      };

      const response = await request(app)
        .post('/api/settings/llm')
        .send(config);

      expect(response.status).toBe(200);
      expect(settingsOps.set).toHaveBeenCalledWith('llm_provider', 'anthropic');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_apiKey', 'sk-ant-key');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_model', 'claude-3-opus-20240229');
    });

    it('should handle partial updates', async () => {
      const response = await request(app)
        .post('/api/settings/llm')
        .send({ provider: 'openai' });

      expect(response.status).toBe(200);
      expect(settingsOps.set).toHaveBeenCalledWith('llm_provider', 'openai');
      // Other settings should be set to undefined/empty
      expect(settingsOps.set).toHaveBeenCalledWith('llm_apiKey', undefined);
      expect(settingsOps.set).toHaveBeenCalledWith('llm_baseUrl', '');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_model', undefined);
    });

    it('should handle empty body', async () => {
      const response = await request(app)
        .post('/api/settings/llm')
        .send({});

      expect(response.status).toBe(200);
      expect(settingsOps.set).toHaveBeenCalledWith('llm_provider', undefined);
      expect(settingsOps.set).toHaveBeenCalledWith('llm_apiKey', undefined);
      expect(settingsOps.set).toHaveBeenCalledWith('llm_baseUrl', '');
      expect(settingsOps.set).toHaveBeenCalledWith('llm_model', undefined);
    });
  });

  describe('Settings Workflow', () => {
    it('should complete full settings cycle', async () => {
      // 1. Save settings
      const saveResponse = await request(app)
        .post('/api/settings/llm')
        .send({
          provider: 'openai',
          apiKey: 'sk-test-key-123456789012345678901234',
          model: 'gpt-4',
          baseUrl: 'https://api.openai.com/v1'
        });

      expect(saveResponse.status).toBe(200);

      // 2. Retrieve settings
      mockGetAll({
        llm_provider: 'openai',
        llm_apiKey: 'sk-test-key-123456789012345678901234',
        llm_model: 'gpt-4',
        llm_baseUrl: 'https://api.openai.com/v1'
      });

      const getResponse = await request(app).get('/api/settings/llm');

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.provider).toBe('openai');
      // Masked format: first 7 chars + ... + last 4 chars
      expect(getResponse.body.apiKey).toBe('sk-test...1234');
      expect(getResponse.body.model).toBe('gpt-4');
    });
  });
});
