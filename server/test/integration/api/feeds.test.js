import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import feedsRouter from '../../../src/routes/feeds.js';
import { feedOps, articleOps } from '../../../src/services/database.js';
import { fetchFeed, syncFeed } from '../../../src/services/rss.js';
import { validateFeedUrl } from '../../../src/services/url-validator.js';
import { isYouTubeChannelUrl, convertYouTubeUrl } from '../../../src/services/youtube-url.js';

// Mock all services
vi.mock('../../../src/services/database.js');
vi.mock('../../../src/services/rss.js');
vi.mock('../../../src/services/url-validator.js');
vi.mock('../../../src/services/youtube-url.js');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/feeds', feedsRouter);

describe('Feeds API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    feedOps.all.mockReturnValue([]);
    feedOps.get.mockReturnValue(null);
    feedOps.insert.mockReturnValue({ id: 1, title: 'Test Feed', url: 'https://example.com/feed.xml' });
    validateFeedUrl.mockResolvedValue({ safe: true });
    fetchFeed.mockResolvedValue({ title: 'Test Feed', items: [] });
    syncFeed.mockResolvedValue({ newCount: 5, total: 10 });
  });

  describe('GET /api/feeds', () => {
    it('should return all feeds', async () => {
      const mockFeeds = [
        { id: 1, title: 'Feed 1', url: 'https://example.com/feed1.xml' },
        { id: 2, title: 'Feed 2', url: 'https://example.com/feed2.xml' }
      ];
      feedOps.all.mockReturnValue(mockFeeds);

      const response = await request(app).get('/api/feeds');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockFeeds);
      expect(feedOps.all).toHaveBeenCalled();
    });
  });

  describe('POST /api/feeds', () => {
    it('should add a new feed successfully', async () => {
      const newFeed = { url: 'https://example.com/feed.xml' };
      const createdFeed = { id: 1, title: 'Test Feed', url: 'https://example.com/feed.xml', created_at: new Date().toISOString() };

      fetchFeed.mockResolvedValue({ title: 'Test Feed', items: [] });
      feedOps.insert.mockReturnValue(createdFeed);
      syncFeed.mockResolvedValue({ newCount: 5, total: 10 });

      const response = await request(app)
        .post('/api/feeds')
        .send(newFeed);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(createdFeed);
      expect(fetchFeed).toHaveBeenCalledWith('https://example.com/feed.xml');
      expect(feedOps.insert).toHaveBeenCalled();
      expect(syncFeed).toHaveBeenCalledWith(1, 'https://example.com/feed.xml');
    });

    it('should return 400 if URL is missing', async () => {
      const response = await request(app)
        .post('/api/feeds')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('URL is required');
    });

    it('should convert YouTube channel URL to feed URL', async () => {
      isYouTubeChannelUrl.mockReturnValue(true);
      convertYouTubeUrl.mockResolvedValue('https://www.youtube.com/feeds/videos.xml?channel_id=123');

      const newFeed = { url: 'https://www.youtube.com/@channel' };
      feedOps.insert.mockReturnValue({ id: 1, title: 'Channel Name', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=123' });

      const response = await request(app)
        .post('/api/feeds')
        .send(newFeed);

      expect(response.status).toBe(200);
      expect(isYouTubeChannelUrl).toHaveBeenCalledWith('https://www.youtube.com/@channel');
      expect(convertYouTubeUrl).toHaveBeenCalledWith('https://www.youtube.com/@channel');
      expect(fetchFeed).toHaveBeenCalledWith('https://www.youtube.com/feeds/videos.xml?channel_id=123');
    });

    it('should block SSRF attacks', async () => {
      validateFeedUrl.mockResolvedValue({ safe: false, reason: 'Private IP address' });

      const response = await request(app)
        .post('/api/feeds')
        .send({ url: 'http://localhost:3000/malicious' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Invalid or blocked URL');
    });

    it('should return 400 on feed fetch failure', async () => {
      fetchFeed.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/feeds')
        .send({ url: 'https://example.com/feed.xml' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Failed to fetch feed. Please check the URL and try again.');
    });

    it('should use hostname as fallback title', async () => {
      fetchFeed.mockResolvedValue({ title: '', items: [] });
      feedOps.insert.mockReturnValue({ id: 1, title: 'example.com', url: 'https://example.com/feed.xml' });

      const response = await request(app)
        .post('/api/feeds')
        .send({ url: 'https://example.com/feed.xml' });

      expect(response.status).toBe(200);
      expect(feedOps.insert).toHaveBeenCalledWith('example.com', 'https://example.com/feed.xml');
    });
  });

  describe('DELETE /api/feeds/:id', () => {
    it('should delete a feed', async () => {
      const response = await request(app).delete('/api/feeds/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(feedOps.delete).toHaveBeenCalledWith(1);
    });

    it('should parse id as integer', async () => {
      const response = await request(app).delete('/api/feeds/42');

      expect(response.status).toBe(200);
      expect(feedOps.delete).toHaveBeenCalledWith(42);
    });
  });

  describe('PATCH /api/feeds/:id', () => {
    it('should update feed title', async () => {
      const existingFeed = { id: 1, title: 'Old Title', url: 'https://example.com/feed.xml' };
      feedOps.get.mockReturnValue(existingFeed);

      const response = await request(app)
        .patch('/api/feeds/1')
        .send({ title: 'New Title' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(feedOps.update).toHaveBeenCalledWith(1, 'New Title');
    });

    it('should return 404 if feed not found', async () => {
      feedOps.get.mockReturnValue(null);

      const response = await request(app)
        .patch('/api/feeds/999')
        .send({ title: 'New Title' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Feed not found');
    });
  });

  describe('POST /api/feeds/:id/sync', () => {
    it('should sync a single feed', async () => {
      const feed = { id: 1, title: 'Test Feed', url: 'https://example.com/feed.xml' };
      feedOps.get.mockReturnValue(feed);
      syncFeed.mockResolvedValue({ newCount: 5, total: 10 });

      const response = await request(app).post('/api/feeds/1/sync');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ newCount: 5, total: 10 });
      expect(syncFeed).toHaveBeenCalledWith(1, 'https://example.com/feed.xml');
    });

    it('should return 404 if feed not found', async () => {
      feedOps.get.mockReturnValue(null);

      const response = await request(app).post('/api/feeds/999/sync');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Feed not found');
    });

    it('should return 400 on sync failure', async () => {
      const feed = { id: 1, title: 'Test Feed', url: 'https://example.com/feed.xml' };
      feedOps.get.mockReturnValue(feed);
      syncFeed.mockRejectedValue(new Error('Sync failed'));

      const response = await request(app).post('/api/feeds/1/sync');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Failed to sync feed. Please try again later.');
    });

    it('should enforce rate limiting', async () => {
      const feed = { id: 1, title: 'Test Feed', url: 'https://example.com/feed.xml' };
      feedOps.get.mockReturnValue(feed);
      syncFeed.mockResolvedValue({ newCount: 5, total: 10 });

      // First request should succeed
      const response1 = await request(app).post('/api/feeds/1/sync');
      expect(response1.status).toBe(200);

      // Second request should be rate limited
      const response2 = await request(app).post('/api/feeds/1/sync');
      expect(response2.status).toBe(429);
      expect(response2.body.error).toContain('Too many sync requests');
    });
  });

  describe('GET /api/feeds/export', () => {
    it('should export feeds as OPML', async () => {
      const mockFeeds = [
        { id: 1, title: 'Feed 1', url: 'https://example.com/feed1.xml' },
        { id: 2, title: 'Feed 2', url: 'https://example.com/feed2.xml' }
      ];
      feedOps.all.mockReturnValue(mockFeeds);

      const response = await request(app).get('/api/feeds/export');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/xml');
      expect(response.headers['content-disposition']).toBe('attachment; filename="feeds.opml"');
      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(response.text).toContain('<opml version="2.0">');
      expect(response.text).toContain('text="Feed 1"');
      expect(response.text).toContain('xmlUrl="https://example.com/feed1.xml"');
    });

    it('should handle empty feed list', async () => {
      feedOps.all.mockReturnValue([]);

      const response = await request(app).get('/api/feeds/export');

      expect(response.status).toBe(200);
      expect(response.text).toContain('<opml version="2.0">');
    });
  });

  describe('POST /api/feeds/import', () => {
    const validOpml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>My Feeds</title>
  </head>
  <body>
    <outline type="rss" text="Feed 1" xmlUrl="https://example.com/feed1.xml"/>
    <outline type="rss" text="Feed 2" xmlUrl="https://example.com/feed2.xml"/>
  </body>
</opml>`;

    it('should import feeds from OPML', async () => {
      feedOps.all.mockReturnValue([]); // No existing feeds
      fetchFeed.mockResolvedValue({ title: 'Feed 1', items: [] });
      syncFeed.mockResolvedValue({ newCount: 5, total: 10 });
      feedOps.insert.mockReturnValue({ id: 1, title: 'Feed 1', url: 'https://example.com/feed1.xml' });

      const response = await request(app)
        .post('/api/feeds/import')
        .send({ opml: validOpml });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('imported');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('total');
      expect(fetchFeed).toHaveBeenCalled();
    });

    it('should return 400 if OPML is missing', async () => {
      const response = await request(app)
        .post('/api/feeds/import')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('OPML data is required');
    });

    it('should skip existing feeds', async () => {
      const existingFeed = { id: 1, title: 'Feed 1', url: 'https://example.com/feed1.xml' };
      feedOps.all.mockReturnValue([existingFeed]);

      const response = await request(app)
        .post('/api/feeds/import')
        .send({ opml: validOpml });

      expect(response.status).toBe(200);
      expect(response.body.imported).toBe(0);
    });

    it('should block SSRF attacks during import', async () => {
      feedOps.all.mockReturnValue([]);
      validateFeedUrl.mockResolvedValue({ safe: false, reason: 'Private IP' });

      const maliciousOpml = `<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline type="rss" text="Malicious" xmlUrl="http://localhost:3000/feed.xml"/>
  </body>
</opml>`;

      const response = await request(app)
        .post('/api/feeds/import')
        .send({ opml: maliciousOpml });

      expect(response.status).toBe(200);
      expect(response.body.blocked).toBeGreaterThan(0);
      expect(response.body.failed).toBeGreaterThan(0);
    });

    it('should handle nested outlines', async () => {
      feedOps.all.mockReturnValue([]);
      fetchFeed.mockResolvedValue({ title: 'Nested Feed', items: [] });
      syncFeed.mockResolvedValue({ newCount: 1, total: 1 });
      feedOps.insert.mockReturnValue({ id: 1, title: 'Nested Feed', url: 'https://example.com/feed.xml' });

      const nestedOpml = `<?xml version="1.0"?>
<opml version="2.0">
  <body>
    <outline text="Category">
      <outline type="rss" text="Nested Feed" xmlUrl="https://example.com/feed.xml"/>
    </outline>
  </body>
</opml>`;

      const response = await request(app)
        .post('/api/feeds/import')
        .send({ opml: nestedOpml });

      expect(response.status).toBe(200);
      expect(fetchFeed).toHaveBeenCalledWith('https://example.com/feed.xml');
    });
  });

  describe('POST /api/feeds/sync-all', () => {
    beforeEach(() => {
      // Reset rate limiter by creating a fresh app for each test
      vi.clearAllMocks();
    });

    it('should sync all feeds with progress updates', async () => {
      const mockFeeds = [
        { id: 1, title: 'Feed 1', url: 'https://example.com/feed1.xml' },
        { id: 2, title: 'Feed 2', url: 'https://example.com/feed2.xml' }
      ];
      feedOps.all.mockReturnValue(mockFeeds);
      syncFeed.mockResolvedValue({ newCount: 5, total: 10 });

      const response = await request(app).post('/api/feeds/sync-all');

      expect(response.status).toBe(200);
      expect(feedOps.all).toHaveBeenCalled();
      expect(syncFeed).toHaveBeenCalledTimes(2);

      // Check response contains streaming data
      const responseBody = response.text;
      expect(responseBody).toContain('type');
      expect(responseBody).toContain('progress');
      expect(responseBody).toContain('complete');
    });

    it('should handle sync failures gracefully', async () => {
      const mockFeeds = [
        { id: 1, title: 'Feed 1', url: 'https://example.com/feed1.xml' }
      ];
      feedOps.all.mockReturnValue(mockFeeds);
      syncFeed.mockRejectedValue(new Error('Sync failed'));

      const response = await request(app).post('/api/feeds/sync-all');

      expect(response.status).toBe(200);
      const responseBody = response.text;
      expect(responseBody).toContain('failed');
    });

    it('should enforce rate limiting', async () => {
      const mockFeeds = [{ id: 1, title: 'Feed 1', url: 'https://example.com/feed1.xml' }];
      feedOps.all.mockReturnValue(mockFeeds);
      syncFeed.mockResolvedValue({ newCount: 1, total: 1 });

      // First request
      const response1 = await request(app).post('/api/feeds/sync-all');
      expect(response1.status).toBe(200);

      // Second request should be rate limited
      const response2 = await request(app).post('/api/feeds/sync-all');
      expect(response2.status).toBe(429);
    });

    it('should handle empty feed list', async () => {
      feedOps.all.mockReturnValue([]);

      const response = await request(app).post('/api/feeds/sync-all');

      expect(response.status).toBe(200);
      expect(syncFeed).not.toHaveBeenCalled();
    });
  });
});
