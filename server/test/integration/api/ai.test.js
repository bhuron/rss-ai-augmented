import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import aiRouter from '../../../src/routes/ai.js';
import { articleOps, settingsOps } from '../../../src/services/database.js';
import { sortArticles, generateDigest } from '../../../src/services/ai.js';

// Mock services
vi.mock('../../../src/services/database.js');
vi.mock('../../../src/services/ai.js');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/ai', aiRouter);

describe('AI API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    settingsOps.getAll.mockReturnValue({});
    articleOps.getByIds.mockReturnValue([]);
  });

  describe('POST /api/ai/sort', () => {
    const defaultConfig = {
      llm_provider: 'openai',
      llm_apiKey: 'sk-test-key',
      llm_model: 'gpt-4',
      llm_baseUrl: ''
    };

    it('should sort articles successfully', async () => {
      const mockArticles = [
        { id: 1, title: 'Article 1', content: 'Content 1' },
        { id: 2, title: 'Article 2', content: 'Content 2' }
      ];
      const sortedResult = {
        categories: [
          { name: 'Tech', articles: [1, 2] }
        ]
      };

      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue(mockArticles);
      sortArticles.mockResolvedValue(sortedResult);

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1, 2], criteria: 'topic' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(sortedResult);
      expect(sortArticles).toHaveBeenCalledWith(defaultConfig, mockArticles, 'topic');
    });

    it('should return 400 if LLM not configured', async () => {
      settingsOps.getAll.mockReturnValue({});

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1, 2] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('LLM not configured. Please configure in Settings.');
    });

    it('should return 400 if API key missing for non-ollama provider', async () => {
      const configWithoutKey = {
        llm_provider: 'openai',
        llm_model: 'gpt-4'
      };
      settingsOps.getAll.mockReturnValue(configWithoutKey);

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1, 2] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('API key not configured. Please add your API key in Settings.');
    });

    it('should allow ollama without API key', async () => {
      const ollamaConfig = {
        llm_provider: 'ollama',
        llm_model: 'llama2'
      };
      const mockArticles = [{ id: 1, title: 'Article 1' }];
      const sortedResult = { categories: [] };

      settingsOps.getAll.mockReturnValue(ollamaConfig);
      articleOps.getByIds.mockReturnValue(mockArticles);
      sortArticles.mockResolvedValue(sortedResult);

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1] });

      expect(response.status).toBe(200);
      expect(sortArticles).toHaveBeenCalled();
    });

    it('should return 400 if no articles found', async () => {
      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue([]);

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1, 2] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No articles found');
    });

    it('should return 500 on sort error', async () => {
      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue([{ id: 1, title: 'Article 1' }]);
      sortArticles.mockRejectedValue(new Error('AI service error'));

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1] });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('AI service error');
    });

    it('should enforce rate limiting', async () => {
      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue([{ id: 1, title: 'Article 1' }]);
      sortArticles.mockResolvedValue({ categories: [] });

      // First request should succeed
      const response1 = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1] });

      expect(response1.status).toBe(200);

      // Second request should be rate limited
      const response2 = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1] });

      expect(response2.status).toBe(429);
      expect(response2.body.error).toContain('Too many AI requests');
    });

    it('should handle missing articleIds', async () => {
      settingsOps.getAll.mockReturnValue(defaultConfig);

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ criteria: 'topic' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No articles found');
    });

    it('should handle empty articleIds array', async () => {
      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue([]);

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No articles found');
    });
  });

  describe('POST /api/ai/digest', () => {
    const defaultConfig = {
      llm_provider: 'openai',
      llm_apiKey: 'sk-test-key',
      llm_model: 'gpt-4',
      llm_baseUrl: ''
    };

    it('should generate digest successfully', async () => {
      const mockArticles = [
        { id: 1, title: 'Article 1', content: 'Content 1' },
        { id: 2, title: 'Article 2', content: 'Content 2' }
      ];
      const digest = 'This is a digest of the articles...';

      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue(mockArticles);
      generateDigest.mockResolvedValue(digest);

      const response = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: [1, 2] });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ digest });
      expect(generateDigest).toHaveBeenCalledWith(defaultConfig, mockArticles);
    });

    it('should return 400 if LLM not configured', async () => {
      settingsOps.getAll.mockReturnValue({});

      const response = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: [1, 2] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('LLM not configured. Please configure in Settings.');
    });

    it('should return 400 if API key missing for non-ollama', async () => {
      const configWithoutKey = {
        llm_provider: 'anthropic',
        llm_model: 'claude-3'
      };
      settingsOps.getAll.mockReturnValue(configWithoutKey);

      const response = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: [1] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('API key not configured. Please add your API key in Settings.');
    });

    it('should allow ollama without API key', async () => {
      const ollamaConfig = {
        llm_provider: 'ollama',
        llm_model: 'llama2'
      };
      const mockArticles = [{ id: 1, title: 'Article 1' }];
      const digest = 'Digest content...';

      settingsOps.getAll.mockReturnValue(ollamaConfig);
      articleOps.getByIds.mockReturnValue(mockArticles);
      generateDigest.mockResolvedValue(digest);

      const response = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: [1] });

      expect(response.status).toBe(200);
      expect(generateDigest).toHaveBeenCalled();
    });

    it('should return 400 if no articles found', async () => {
      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue([]);

      const response = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: [1] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No articles found');
    });

    it('should return 500 on digest generation error', async () => {
      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue([{ id: 1, title: 'Article 1' }]);
      generateDigest.mockRejectedValue(new Error('Failed to generate digest'));

      const response = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: [1] });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to generate digest');
    });

    it('should enforce rate limiting', async () => {
      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue([{ id: 1, title: 'Article 1' }]);
      generateDigest.mockResolvedValue('Digest');

      // First request should succeed
      const response1 = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: [1] });

      expect(response1.status).toBe(200);

      // Second request should be rate limited
      const response2 = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: [1] });

      expect(response2.status).toBe(429);
    });

    it('should handle large article sets', async () => {
      const mockArticles = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        title: `Article ${i + 1}`,
        content: `Content ${i + 1}`
      }));

      settingsOps.getAll.mockReturnValue(defaultConfig);
      articleOps.getByIds.mockReturnValue(mockArticles);
      generateDigest.mockResolvedValue('Long digest...');

      const response = await request(app)
        .post('/api/ai/digest')
        .send({ articleIds: mockArticles.map(a => a.id) });

      expect(response.status).toBe(200);
      expect(generateDigest).toHaveBeenCalledWith(defaultConfig, mockArticles);
    });
  });

  describe('AI Service Configuration Edge Cases', () => {
    it('should handle different providers', async () => {
      const providers = ['openai', 'anthropic', 'openrouter', 'ollama'];

      for (const provider of providers) {
        vi.clearAllMocks();
        articleOps.getByIds.mockReturnValue([{ id: 1, title: 'Article 1' }]);
        sortArticles.mockResolvedValue({ categories: [] });

        const config = {
          [`llm_provider`]: provider,
          [`llm_model`]: 'test-model'
        };

        // Only non-ollama providers need API keys
        if (provider !== 'ollama') {
          config[`llm_apiKey`] = 'sk-test-key';
        }

        settingsOps.getAll.mockReturnValue(config);

        const response = await request(app)
          .post('/api/ai/sort')
          .send({ articleIds: [1] });

        expect(response.status).toBe(200);
      }
    });

    it('should handle baseUrl for custom endpoints', async () => {
      const configWithBaseUrl = {
        llm_provider: 'openai',
        llm_apiKey: 'sk-test-key',
        llm_model: 'gpt-4',
        llm_baseUrl: 'https://custom-endpoint.com/v1'
      };

      settingsOps.getAll.mockReturnValue(configWithBaseUrl);
      articleOps.getByIds.mockReturnValue([{ id: 1, title: 'Article 1' }]);
      sortArticles.mockResolvedValue({ categories: [] });

      const response = await request(app)
        .post('/api/ai/sort')
        .send({ articleIds: [1] });

      expect(response.status).toBe(200);
      expect(sortArticles).toHaveBeenCalledWith(
        configWithBaseUrl,
        expect.any(Array),
        undefined
      );
    });
  });
});
