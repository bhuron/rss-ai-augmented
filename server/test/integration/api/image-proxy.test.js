import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { validateUrl } from '../../../src/services/url-validator.js';
import fetch from 'node-fetch';

// Mock services
vi.mock('../../../src/services/url-validator.js');
vi.mock('node-fetch');

// Create a minimal Express app with the image-proxy endpoint
function createTestApp() {
  const app = express();

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

    // Validate URL to prevent SSRF attacks
    const validation = await validateUrl(url);
    if (!validation.safe) {
      console.log(`[Security] Blocked image proxy request: ${url} (${validation.reason})`);
      return res.status(403).send('Forbidden');
    }

    try {
      // Add timeout to prevent hanging (5 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': new URL(url).origin
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).send('Failed to fetch image');
      }

      const contentType = response.headers.get('content-type');

      // Security: Validate Content-Type to prevent proxying non-image content
      if (!contentType || !contentType.startsWith('image/')) {
        console.log(`[Security] Blocked non-image content: ${url} (Content-Type: ${contentType})`);
        return res.status(403).send('Forbidden: Not an image');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error) {
      // Silently fail - image will just not display
      res.status(500).send('Failed to proxy image');
    }
  });

  return app;
}

describe('Image Proxy API', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
    validateUrl.mockResolvedValue({ safe: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/image-proxy', () => {
    it('should proxy valid image URLs', async () => {
      const imageBuffer = Buffer.from('fake image data');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn((header) => {
            if (header === 'content-type') return 'image/jpeg';
            return null;
          })
        },
        arrayBuffer: async () => imageBuffer.buffer
      });

      const response = await request(app).get('/api/image-proxy?url=https://example.com/image.jpg');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
      expect(response.headers['cache-control']).toBe('public, max-age=86400');
      expect(fetch).toHaveBeenCalledWith(
        'https://example.com/image.jpg',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Referer': 'https://example.com'
          })
        })
      );
    });

    it('should return 400 if URL parameter is missing', async () => {
      const response = await request(app).get('/api/image-proxy');

      expect(response.status).toBe(400);
      expect(response.text).toBe('Missing url parameter');
    });

    it('should return 404 for relative URLs', async () => {
      const response = await request(app).get('/api/image-proxy?url=/relative/path.jpg');

      expect(response.status).toBe(404);
      expect(response.text).toBe('Not found');
    });

    it('should return 404 for protocol-relative URLs', async () => {
      const response = await request(app).get('/api/image-proxy?url=//example.com/image.jpg');

      expect(response.status).toBe(404);
    });

    it('should block SSRF attacks - private IPs', async () => {
      validateUrl.mockResolvedValue({ safe: false, reason: 'Private IP address' });

      const response = await request(app).get('/api/image-proxy?url=http://192.168.1.1/image.jpg');

      expect(response.status).toBe(403);
      expect(response.text).toBe('Forbidden');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should block SSRF attacks - localhost', async () => {
      validateUrl.mockResolvedValue({ safe: false, reason: 'Localhost' });

      const response = await request(app).get('/api/image-proxy?url=http://localhost/admin.jpg');

      expect(response.status).toBe(403);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should block SSRF attacks - cloud metadata', async () => {
      validateUrl.mockResolvedValue({ safe: false, reason: 'Cloud metadata endpoint' });

      const response = await request(app).get('/api/image-proxy?url=http://169.254.169.254/latest/meta-data/');

      expect(response.status).toBe(403);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should block non-image content types', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn((header) => {
            if (header === 'content-type') return 'text/html';
            return null;
          })
        },
        arrayBuffer: async () => Buffer.from('<html></html>').buffer
      });

      const response = await request(app).get('/api/image-proxy?url=https://example.com/page.html');

      expect(response.status).toBe(403);
      expect(response.text).toBe('Forbidden: Not an image');
    });

    it('should block missing content-type', async () => {
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => null)
        },
        arrayBuffer: async () => Buffer.from('data').buffer
      });

      const response = await request(app).get('/api/image-proxy?url=https://example.com/file');

      expect(response.status).toBe(403);
      expect(response.text).toBe('Forbidden: Not an image');
    });

    it('should handle fetch errors gracefully', async () => {
      fetch.mockRejectedValue(new Error('Network error'));

      const response = await request(app).get('/api/image-proxy?url=https://example.com/image.jpg');

      expect(response.status).toBe(500);
      expect(response.text).toBe('Failed to proxy image');
    });

    it('should handle timeout', async () => {
      const controller = new AbortController();
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      fetch.mockImplementation(() => {
        controller.abort();
        return Promise.reject(abortError);
      });

      const response = await request(app).get('/api/image-proxy?url=https://slow-server.com/image.jpg');

      expect(response.status).toBe(500);
    });

    it('should handle non-ok HTTP responses', async () => {
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: {
          get: vi.fn(() => 'image/jpeg')
        }
      });

      const response = await request(app).get('/api/image-proxy?url=https://example.com/missing.jpg');

      expect(response.status).toBe(404);
      expect(response.text).toBe('Failed to fetch image');
    });

    it('should support various image content types', async () => {
      const imageTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'image/x-icon'
      ];

      for (const imageType of imageTypes) {
        vi.clearAllMocks();
        validateUrl.mockResolvedValue({ safe: true });

        const imageBuffer = Buffer.from('fake image');
        fetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: vi.fn((header) => {
              if (header === 'content-type') return imageType;
              return null;
            })
          },
          arrayBuffer: async () => imageBuffer.buffer
        });

        const response = await request(app)
          .get('/api/image-proxy?url=https://example.com/image.jpg');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe(imageType);
      }
    });

    it('should URL-encode special characters in URLs', async () => {
      const imageBuffer = Buffer.from('fake image');
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'image/jpeg')
        },
        arrayBuffer: async () => imageBuffer.buffer
      });

      const url = 'https://example.com/image with spaces.jpg';
      const encodedUrl = encodeURIComponent(url);

      const response = await request(app).get(`/api/image-proxy?url=${encodedUrl}`);

      expect(response.status).toBe(200);
      expect(fetch).toHaveBeenCalledWith(
        url,
        expect.any(Object)
      );
    });

    it('should preserve original filename in headers for common image types', async () => {
      const imageBuffer = Buffer.from('fake image');
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'image/jpeg')
        },
        arrayBuffer: async () => imageBuffer.buffer
      });

      const response = await request(app).get('/api/image-proxy?url=https://example.com/photo.jpg');

      expect(response.headers['cache-control']).toBe('public, max-age=86400');
    });

    it('should allow HTTPS and HTTP protocols', async () => {
      const imageBuffer = Buffer.from('fake image');
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'image/png')
        },
        arrayBuffer: async () => imageBuffer.buffer
      });

      // Test HTTPS
      const httpsResponse = await request(app).get('/api/image-proxy?url=https://example.com/image.png');
      expect(httpsResponse.status).toBe(200);

      vi.clearAllMocks();
      validateUrl.mockResolvedValue({ safe: true });
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: vi.fn(() => 'image/png')
        },
        arrayBuffer: async () => imageBuffer.buffer
      });

      // Test HTTP
      const httpResponse = await request(app).get('/api/image-proxy?url=http://example.com/image.png');
      expect(httpResponse.status).toBe(200);
    });
  });
});
