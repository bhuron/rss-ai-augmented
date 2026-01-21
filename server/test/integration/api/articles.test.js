import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import articlesRouter from '../../../src/routes/articles.js';
import { articleOps } from '../../../src/services/database.js';

// Mock database service
vi.mock('../../../src/services/database.js');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/articles', articlesRouter);

describe('Articles API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock
    articleOps.all.mockReturnValue([]);
    articleOps.updateRead.mockReturnValue(undefined);
    articleOps.updateSaved.mockReturnValue(undefined);
  });

  describe('GET /api/articles', () => {
    it('should return all articles when no query params', async () => {
      const mockArticles = [
        { id: 1, title: 'Article 1', is_read: false },
        { id: 2, title: 'Article 2', is_read: false }
      ];
      articleOps.all.mockReturnValue(mockArticles);

      const response = await request(app).get('/api/articles');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockArticles);
      expect(articleOps.all).toHaveBeenCalledWith(null, false);
    });

    it('should filter by feedId', async () => {
      const mockArticles = [
        { id: 1, title: 'Article 1', feed_id: 1 }
      ];
      articleOps.all.mockReturnValue(mockArticles);

      const response = await request(app).get('/api/articles?feedId=1');

      expect(response.status).toBe(200);
      expect(articleOps.all).toHaveBeenCalledWith(1, false);
    });

    it('should filter unread articles', async () => {
      const mockArticles = [
        { id: 1, title: 'Article 1', is_read: false }
      ];
      articleOps.all.mockReturnValue(mockArticles);

      const response = await request(app).get('/api/articles?unreadOnly=true');

      expect(response.status).toBe(200);
      expect(articleOps.all).toHaveBeenCalledWith(null, true);
    });

    it('should filter by both feedId and unreadOnly', async () => {
      const mockArticles = [
        { id: 1, title: 'Article 1', feed_id: 1, is_read: false }
      ];
      articleOps.all.mockReturnValue(mockArticles);

      const response = await request(app).get('/api/articles?feedId=1&unreadOnly=true');

      expect(response.status).toBe(200);
      expect(articleOps.all).toHaveBeenCalledWith(1, true);
    });

    it('should handle unreadOnly=false', async () => {
      const response = await request(app).get('/api/articles?unreadOnly=false');

      expect(response.status).toBe(200);
      expect(articleOps.all).toHaveBeenCalledWith(null, false);
    });
  });

  describe('PATCH /api/articles/:id/read', () => {
    it('should mark article as read', async () => {
      const response = await request(app)
        .patch('/api/articles/1/read')
        .send({ isRead: true });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(articleOps.updateRead).toHaveBeenCalledWith(1, true);
    });

    it('should mark article as unread', async () => {
      const response = await request(app)
        .patch('/api/articles/1/read')
        .send({ isRead: false });

      expect(response.status).toBe(200);
      expect(articleOps.updateRead).toHaveBeenCalledWith(1, false);
    });

    it('should parse id as integer', async () => {
      const response = await request(app)
        .patch('/api/articles/42/read')
        .send({ isRead: true });

      expect(response.status).toBe(200);
      expect(articleOps.updateRead).toHaveBeenCalledWith(42, true);
    });

    it('should handle missing isRead body', async () => {
      const response = await request(app)
        .patch('/api/articles/1/read')
        .send({});

      expect(response.status).toBe(200);
      expect(articleOps.updateRead).toHaveBeenCalledWith(1, undefined);
    });
  });

  describe('PATCH /api/articles/:id/saved', () => {
    it('should mark article as saved', async () => {
      const response = await request(app)
        .patch('/api/articles/1/saved')
        .send({ isSaved: true });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(articleOps.updateSaved).toHaveBeenCalledWith(1, true);
    });

    it('should unmark article as saved', async () => {
      const response = await request(app)
        .patch('/api/articles/1/saved')
        .send({ isSaved: false });

      expect(response.status).toBe(200);
      expect(articleOps.updateSaved).toHaveBeenCalledWith(1, false);
    });

    it('should parse id as integer', async () => {
      const response = await request(app)
        .patch('/api/articles/99/saved')
        .send({ isSaved: true });

      expect(response.status).toBe(200);
      expect(articleOps.updateSaved).toHaveBeenCalledWith(99, true);
    });

    it('should handle missing isSaved body', async () => {
      const response = await request(app)
        .patch('/api/articles/1/saved')
        .send({});

      expect(response.status).toBe(200);
      expect(articleOps.updateSaved).toHaveBeenCalledWith(1, undefined);
    });
  });

  describe('Combined Operations', () => {
    it('should handle multiple status updates', async () => {
      // Mark as read
      const readResponse = await request(app)
        .patch('/api/articles/1/read')
        .send({ isRead: true });

      expect(readResponse.status).toBe(200);

      // Mark as saved
      const savedResponse = await request(app)
        .patch('/api/articles/1/saved')
        .send({ isSaved: true });

      expect(savedResponse.status).toBe(200);

      expect(articleOps.updateRead).toHaveBeenCalledWith(1, true);
      expect(articleOps.updateSaved).toHaveBeenCalledWith(1, true);
    });
  });
});
