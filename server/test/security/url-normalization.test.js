import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../../src/utils/url.js';

describe('URL Normalization', () => {
  describe('Google Analytics Parameters (utm_*)', () => {
    it('should remove single utm_ parameter', () => {
      const url = 'https://example.com/article?utm_source=google';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove multiple utm_ parameters', () => {
      const url = 'https://example.com/article?utm_source=google&utm_medium=social&utm_campaign=spring';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should preserve non-utm parameters', () => {
      const url = 'https://example.com/article?id=123&utm_source=google';
      expect(normalizeUrl(url)).toBe('https://example.com/article?id=123');
    });
  });

  describe('Facebook and Google Click IDs', () => {
    it('should remove fbclid parameter', () => {
      const url = 'https://example.com/article?fbclid=abcd1234';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove gclid parameter', () => {
      const url = 'https://example.com/article?gclid=xyz789';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove both fbclid and gclid', () => {
      const url = 'https://example.com/article?fbclid=abcd&gclid=xyz';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });
  });

  describe('Email Marketing Parameters', () => {
    it('should remove Mailchimp parameters', () => {
      const url = 'https://example.com/article?mc_cid=123&mc_eid=456';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove HubSpot parameters', () => {
      const url = 'https://example.com/article?_hsenc=abc&_hsmi=def';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });
  });

  describe('Newsletter Platform Parameters', () => {
    it('should remove Substack parameters', () => {
      const url = 'https://example.com/article?r=abc&s=def&publication_id=123&post_id=456';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove Ghost t parameter', () => {
      const url = 'https://example.com/article?t=12345';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });
  });

  describe('WordPress and Other Platforms', () => {
    it('should remove share parameter', () => {
      const url = 'https://example.com/article?share=twitter';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove doing_wp_cron parameter', () => {
      const url = 'https://example.com/article?doing_wp_cron=123456';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove ref parameter', () => {
      const url = 'https://example.com/article?ref=hackernews';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove source parameter', () => {
      const url = 'https://example.com/article?source=newsletter';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });
  });

  describe('YouTube URLs - Video ID Preservation', () => {
    it('should preserve YouTube v parameter on youtube.com', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(normalizeUrl(url)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should preserve YouTube v parameter with tracking params', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=newsletter';
      expect(normalizeUrl(url)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should handle youtu.be short URLs', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ?utm_source=twitter';
      expect(normalizeUrl(url)).toBe('https://youtu.be/dQw4w9WgXcQ');
    });

    it('should remove other tracking params from YouTube but keep v', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&t=10s';
      expect(normalizeUrl(url)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('should not remove v parameter from non-YouTube URLs', () => {
      const url = 'https://example.com/article?v=version';
      expect(normalizeUrl(url)).toBe('https://example.com/article?v=version');
    });
  });

  describe('URL Hash/Fragment Removal', () => {
    it('should remove URL hash', () => {
      const url = 'https://example.com/article#section';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove hash with timestamp', () => {
      const url = 'https://example.com/article#timestamp=123456';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should remove hash but preserve query params', () => {
      const url = 'https://example.com/article?id=123#section';
      expect(normalizeUrl(url)).toBe('https://example.com/article?id=123');
    });

    it('should remove hash and tracking params', () => {
      const url = 'https://example.com/article?utm_source=google#section';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });
  });

  describe('Complex Real-World Scenarios', () => {
    it('should handle URL with all tracking parameters', () => {
      const url = 'https://example.com/article?utm_source=google&utm_medium=social&fbclid=abc123&id=456#section';
      expect(normalizeUrl(url)).toBe('https://example.com/article?id=456');
    });

    it('should handle newsletter link', () => {
      const url = 'https://blog.example.com/post/awesome-article?mc_cid=news123&mc_eid=open&sub_id=456';
      expect(normalizeUrl(url)).toBe('https://blog.example.com/post/awesome-article?sub_id=456');
    });

    it('should handle social media share link', () => {
      const url = 'https://news.example.com/story?id=123456&share=facebook&ref=twitter&utm_campaign=viral';
      expect(normalizeUrl(url)).toBe('https://news.example.com/story?id=123456');
    });

    it('should handle YouTube with full tracking', () => {
      const url = 'https://www.youtube.com/watch?v=abc123&feature=share&fbclid=xyz&utm_source=newsletter#t=10s';
      expect(normalizeUrl(url)).toBe('https://www.youtube.com/watch?v=abc123');
    });
  });

  describe('Edge Cases', () => {
    it('should return original URL if parsing fails', () => {
      const url = 'not-a-valid-url';
      expect(normalizeUrl(url)).toBe('not-a-valid-url');
    });

    it('should handle URL with no parameters', () => {
      const url = 'https://example.com/article';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should handle URL with only tracking params', () => {
      const url = 'https://example.com/article?utm_source=test';
      expect(normalizeUrl(url)).toBe('https://example.com/article');
    });

    it('should preserve case of path but normalize hostname to lowercase', () => {
      const url = 'https://Example.com/Article?ID=123&utm_source=test';
      // URL constructor normalizes hostname to lowercase (domain names are case-insensitive)
      expect(normalizeUrl(url)).toBe('https://example.com/Article?ID=123');
    });

    it('should handle empty parameter values', () => {
      const url = 'https://example.com/article?id=&utm_source=';
      expect(normalizeUrl(url)).toBe('https://example.com/article?id=');
    });

    it('should handle parameters with special characters', () => {
      const url = 'https://example.com/article?url=https%3A%2F%2Fother.com&utm_source=test';
      expect(normalizeUrl(url)).toBe('https://example.com/article?url=https%3A%2F%2Fother.com');
    });
  });

  describe('Duplicate Detection Scenarios', () => {
    it('should detect duplicates when only tracking params differ', () => {
      const url1 = 'https://example.com/article?utm_source=google';
      const url2 = 'https://example.com/article?utm_medium=twitter';
      expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
    });

    it('should detect duplicates when hash differs', () => {
      const url1 = 'https://example.com/article#section1';
      const url2 = 'https://example.com/article#section2';
      expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
    });

    it('should not detect duplicates when content params differ', () => {
      const url1 = 'https://example.com/article?id=1';
      const url2 = 'https://example.com/article?id=2';
      expect(normalizeUrl(url1)).not.toBe(normalizeUrl(url2));
    });

    it('should detect YouTube duplicates with different tracking', () => {
      const url1 = 'https://www.youtube.com/watch?v=abc123&utm_source=newsletter';
      const url2 = 'https://www.youtube.com/watch?v=abc123&feature=share';
      expect(normalizeUrl(url1)).toBe(normalizeUrl(url2));
    });
  });

  describe('Query Parameter Ordering', () => {
    it('should not change parameter order', () => {
      const url = 'https://example.com/article?b=2&a=1&utm_source=test';
      // URLSearchParams preserves parameter order
      expect(normalizeUrl(url)).toBe('https://example.com/article?b=2&a=1');
    });

    it('should not normalize order for duplicate detection', () => {
      const url1 = 'https://example.com/article?a=1&b=2';
      const url2 = 'https://example.com/article?b=2&a=1';
      // Different parameter order = different URLs (this is expected)
      expect(normalizeUrl(url1)).not.toBe(normalizeUrl(url2));
    });
  });
});
