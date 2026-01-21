import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchFeed, syncFeed } from '../../../src/services/rss.js';
import Parser from 'rss-parser';
import fetch from 'node-fetch';
import iconv from 'iconv-lite';
import { articleOps } from '../../../src/services/database.js';

// Mock dependencies
vi.mock('rss-parser');
vi.mock('node-fetch');
vi.mock('iconv-lite');
vi.mock('../../../src/services/database.js');

describe('RSS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for articleOps.insert
    articleOps.insert.mockReturnValue({ id: 1 });
  });

  afterEach(() => {
    // Reset INCLUDE_SHORTS to undefined
    delete process.env.INCLUDE_SHORTS;
  });

  describe('fetchFeed', () => {
    it('should fetch and parse feed with utf-8 encoding', async () => {
      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockFeed = { items: [{ title: 'Test' }] };
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: vi.fn((header) => {
            if (header === 'content-type') return 'application/xml; charset=utf-8';
            return null;
          })
        },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      const result = await fetchFeed('https://example.com/feed.xml');

      expect(result).toEqual(mockFeed);
      expect(fetch).toHaveBeenCalledWith('https://example.com/feed.xml', expect.any(Object));
      expect(iconv.decode).toHaveBeenCalledWith(expect.any(Buffer), 'utf-8');
    });

    it('should detect encoding from Content-Type header', async () => {
      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockFeed = { items: [{ title: 'Test' }] };
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: vi.fn((header) => {
            if (header === 'content-type') return 'application/xml; charset=iso-8859-1';
            return null;
          })
        },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await fetchFeed('https://example.com/feed.xml');

      expect(iconv.decode).toHaveBeenCalledWith(expect.any(Buffer), 'iso-8859-1');
    });

    it('should handle encoding without charset in Content-Type', async () => {
      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockFeed = { items: [{ title: 'Test' }] };
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: vi.fn(() => null)
        },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await fetchFeed('https://example.com/feed.xml');

      expect(iconv.decode).toHaveBeenCalledWith(expect.any(Buffer), 'utf-8');
    });

    it('should timeout after 15 seconds', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';

      fetch.mockRejectedValue(abortError);

      await expect(fetchFeed('https://example.com/feed.xml')).rejects.toThrow('Feed request timed out');
    });

    it('should fallback to default parser on network error', async () => {
      const mockFeed = { items: [{ title: 'Test' }] };

      fetch.mockRejectedValue(new Error('Network error'));
      Parser.prototype.parseURL.mockResolvedValue(mockFeed);

      const result = await fetchFeed('https://example.com/feed.xml');

      expect(result).toEqual(mockFeed);
      expect(Parser.prototype.parseURL).toHaveBeenCalledWith('https://example.com/feed.xml');
    });

    it('should handle various encoding types', async () => {
      const encodings = ['utf-8', 'iso-8859-1', 'windows-1252', 'shift_jis'];

      for (const encoding of encodings) {
        vi.clearAllMocks();
        articleOps.insert.mockReturnValue({ id: 1 });

        const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
        const mockFeed = { items: [{ title: 'Test' }] };
        const mockBuffer = Buffer.from(mockXml, 'utf-8');

        fetch.mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            get: vi.fn((header) => {
              if (header === 'content-type') return `application/xml; charset=${encoding}`;
              return null;
            })
          },
          arrayBuffer: async () => mockBuffer.buffer
        });

        iconv.decode.mockReturnValue(mockXml);
        Parser.prototype.parseString.mockResolvedValue(mockFeed);

        await fetchFeed('https://example.com/feed.xml');

        expect(iconv.decode).toHaveBeenCalledWith(expect.any(Buffer), encoding);
      }
    });

    it('should handle HTTP error by falling back to default parser', async () => {
      const mockFeed = { items: [{ title: 'Test' }] };

      fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      Parser.prototype.parseURL.mockResolvedValue(mockFeed);

      const result = await fetchFeed('https://example.com/feed.xml');

      expect(result).toEqual(mockFeed);
      expect(Parser.prototype.parseURL).toHaveBeenCalled();
    });
  });

  describe('syncFeed - Integration Tests', () => {
    // These tests mock at the fetch/Parser level to test the full syncFeed logic
    // including YouTube handling, image extraction, etc.

    it('should extract YouTube video ID and construct thumbnail URL', async () => {
      const mockFeed = {
        items: [{
          title: 'Test Video',
          link: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          contentSnippet: 'Description',
          pubDate: '2024-01-01T00:00:00Z'
        }]
      };

      const mockXml = '<rss><channel><item><title>Test Video</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://www.youtube.com/feeds/videos.xml');

      expect(articleOps.insert).toHaveBeenCalledWith(
        1,
        'Test Video',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        expect.any(String),
        '2024-01-01T00:00:00Z',
        'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
      );
    });

    it('should handle youtu.be short URLs', async () => {
      const mockFeed = {
        items: [{
          title: 'Test Video',
          link: 'https://youtu.be/dQw4w9WgXcQ',
          contentSnippet: 'Description',
          pubDate: '2024-01-01T00:00:00Z'
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://www.youtube.com/feeds/videos.xml');

      expect(articleOps.insert).toHaveBeenCalledWith(
        1,
        'Test Video',
        'https://youtu.be/dQw4w9WgXcQ',
        expect.any(String),
        '2024-01-01T00:00:00Z',
        'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
      );
    });

    it('should skip YouTube Shorts when INCLUDE_SHORTS is not true', async () => {
      process.env.INCLUDE_SHORTS = 'false';

      const mockFeed = {
        items: [
          {
            title: 'Normal Video',
            link: 'https://www.youtube.com/watch?v=abc123',
            contentSnippet: 'Description',
            pubDate: '2024-01-01T00:00:00Z'
          },
          {
            title: 'Short Video',
            link: 'https://www.youtube.com/shorts/xyz789',
            contentSnippet: 'Short description',
            pubDate: '2024-01-01T00:00:00Z'
          }
        ]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      const result = await syncFeed(1, 'https://www.youtube.com/feeds/videos.xml');

      expect(articleOps.insert).toHaveBeenCalledTimes(1);
      expect(articleOps.insert).toHaveBeenCalledWith(
        1,
        'Normal Video',
        'https://www.youtube.com/watch?v=abc123',
        expect.any(String),
        '2024-01-01T00:00:00Z',
        'https://img.youtube.com/vi/abc123/hqdefault.jpg'
      );
      expect(result.newCount).toBe(1);
    });

    it('should include YouTube Shorts when INCLUDE_SHORTS is true', async () => {
      process.env.INCLUDE_SHORTS = 'true';

      const mockFeed = {
        items: [
          {
            title: 'Normal Video',
            link: 'https://www.youtube.com/watch?v=abc123',
            contentSnippet: 'Description',
            pubDate: '2024-01-01T00:00:00Z'
          },
          {
            title: 'Short Video',
            link: 'https://www.youtube.com/shorts/xyz789',
            contentSnippet: 'Short description',
            pubDate: '2024-01-01T00:00:00Z'
          }
        ]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      const result = await syncFeed(1, 'https://www.youtube.com/feeds/videos.xml');

      expect(articleOps.insert).toHaveBeenCalledTimes(2);
      expect(result.newCount).toBe(2);
    });

    it('should clean YouTube descriptions', async () => {
      const mockFeed = {
        items: [{
          title: 'Test Video',
          link: 'https://www.youtube.com/watch?v=abc123',
          'media:group': {
            'media:description': 'Check out my content!\nhttps://twitter.com/mychannel\nFollow me on Instagram for more!'
          },
          pubDate: '2024-01-01T00:00:00Z'
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://www.youtube.com/feeds/videos.xml');

      const contentArg = articleOps.insert.mock.calls[0][3];
      // Removes URLs and social media promotional lines
      expect(contentArg).not.toContain('https://twitter.com');
      expect(contentArg).not.toContain('Instagram');
    });

    it('should extract image from media:group media:thumbnail', async () => {
      const mockFeed = {
        items: [{
          title: 'Test Article',
          link: 'https://example.com/article',
          contentSnippet: 'Description',
          pubDate: '2024-01-01T00:00:00Z',
          'media:group': {
            'media:thumbnail': {
              $: { url: 'https://example.com/image.jpg' }
            }
          }
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://example.com/feed.xml');

      expect(articleOps.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'https://example.com/image.jpg'
      );
    });

    it('should extract image from enclosure', async () => {
      const mockFeed = {
        items: [{
          title: 'Test Article',
          link: 'https://example.com/article',
          contentSnippet: 'Description',
          pubDate: '2024-01-01T00:00:00Z',
          enclosure: {
            url: 'https://example.com/enclosure.jpg',
            type: 'image/jpeg'
          }
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://example.com/feed.xml');

      expect(articleOps.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'https://example.com/enclosure.jpg'
      );
    });

    it('should extract image from HTML content', async () => {
      const mockFeed = {
        items: [{
          title: 'Test Article',
          link: 'https://example.com/article',
          content: '<p>Article content</p><img src="https://example.com/content.jpg" alt="Image">',
          pubDate: '2024-01-01T00:00:00Z'
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://example.com/feed.xml');

      expect(articleOps.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        'https://example.com/content.jpg'
      );
    });

    it('should not extract non-image enclosure', async () => {
      const mockFeed = {
        items: [{
          title: 'Test Article',
          link: 'https://example.com/article',
          contentSnippet: 'Description',
          pubDate: '2024-01-01T00:00:00Z',
          enclosure: {
            url: 'https://example.com/audio.mp3',
            type: 'audio/mpeg'
          }
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://example.com/feed.xml');

      expect(articleOps.insert).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        null
      );
    });

    it('should handle empty feed', async () => {
      const mockFeed = { items: [] };

      const mockXml = '<rss><channel></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      const result = await syncFeed(1, 'https://example.com/feed.xml');

      expect(result.newCount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should count duplicates correctly', async () => {
      const mockFeed = {
        items: [
          { title: 'Article 1', link: 'https://example.com/1', contentSnippet: 'Desc', pubDate: '2024-01-01T00:00:00Z' },
          { title: 'Article 2', link: 'https://example.com/2', contentSnippet: 'Desc', pubDate: '2024-01-01T00:00:00Z' }
        ]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);
      articleOps.insert.mockReturnValueOnce({ id: 1 }).mockReturnValueOnce(null);

      const result = await syncFeed(1, 'https://example.com/feed.xml');

      expect(result.newCount).toBe(1);
      expect(result.total).toBe(2);
    });

    it('should use current date when pubDate is missing', async () => {
      const mockFeed = {
        items: [{
          title: 'Article',
          link: 'https://example.com/article',
          contentSnippet: 'Description'
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://example.com/feed.xml');

      const pubDateArg = articleOps.insert.mock.calls[0][4];
      expect(pubDateArg).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should use content over content:encoded for non-YouTube feeds', async () => {
      // For non-YouTube feeds, the code uses contentSnippet || content || ''
      // content:encoded is only used for image extraction, not for stored content
      const mockFeed = {
        items: [{
          title: 'Article',
          link: 'https://example.com/article',
          contentSnippet: 'Snippet content',
          'content:encoded': '<p>Encoded content</p>',
          content: 'Plain content',
          pubDate: '2024-01-01T00:00:00Z'
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://example.com/feed.xml');

      const contentArg = articleOps.insert.mock.calls[0][3];
      // Prefers contentSnippet over content
      expect(contentArg).toBe('Snippet content');
    });

    it('should use contentSnippet when content is not available', async () => {
      const mockFeed = {
        items: [{
          title: 'Article',
          link: 'https://example.com/article',
          contentSnippet: 'Snippet content',
          pubDate: '2024-01-01T00:00:00Z'
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://example.com/feed.xml');

      const contentArg = articleOps.insert.mock.calls[0][3];
      expect(contentArg).toBe('Snippet content');
    });

    it('should handle missing content fields', async () => {
      const mockFeed = {
        items: [{
          title: 'Article',
          link: 'https://example.com/article',
          pubDate: '2024-01-01T00:00:00Z'
        }]
      };

      const mockXml = '<rss><channel><item><title>Test</title></item></channel></rss>';
      const mockBuffer = Buffer.from(mockXml, 'utf-8');

      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: vi.fn(() => 'application/xml') },
        arrayBuffer: async () => mockBuffer.buffer
      });

      iconv.decode.mockReturnValue(mockXml);
      Parser.prototype.parseString.mockResolvedValue(mockFeed);

      await syncFeed(1, 'https://example.com/feed.xml');

      expect(articleOps.insert).toHaveBeenCalled();
      const contentArg = articleOps.insert.mock.calls[0][3];
      expect(contentArg).toBe('');
    });
  });
});
