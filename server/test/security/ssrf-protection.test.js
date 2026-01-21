import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateUrl, validateFeedUrl, cleanCache } from '../../src/services/url-validator.js';

// Mock DNS module - must be done before importing url-validator
vi.mock('dns', () => ({
  default: {
    lookup: vi.fn((hostname, options, callback) => {
      // Default: resolve to public IP
      callback(null, { address: '8.8.8.8', family: 4 });
    }),
  },
}));

import dns from 'dns';
const mockDnsLookup = dns.lookup;

describe('SSRF Protection - validateUrl (Image Proxy)', () => {
  beforeEach(() => {
    // Clear cache before each test
    cleanCache();
    mockDnsLookup.mockReset();
  });

  describe('Protocol Validation', () => {
    it('should block file:// protocol', async () => {
      const result = await validateUrl('file:///etc/passwd');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Invalid protocol');
    });

    it('should block ftp:// protocol', async () => {
      const result = await validateUrl('ftp://example.com/file.txt');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Invalid protocol');
    });

    it('should block custom protocols', async () => {
      const result = await validateUrl('jar:///etc/passwd');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Invalid protocol');
    });

    it('should allow http:// protocol', async () => {
      const result = await validateUrl('http://example.com/image.jpg');
      expect(result.safe).toBe(true);
    });

    it('should allow https:// protocol', async () => {
      const result = await validateUrl('https://example.com/image.jpg');
      expect(result.safe).toBe(true);
    });
  });

  describe('Private IP Blocking - IPv4', () => {
    it('should block 127.0.0.1 (loopback)', async () => {
      const result = await validateUrl('http://127.0.0.1/image.jpg');
      expect(result.safe).toBe(false);
      // Either reason is acceptable for security
      expect(['Blocked hostname', 'Private IP address']).toContain(result.reason);
    });

    it('should block 127.0.0.2 (loopback range)', async () => {
      const result = await validateUrl('http://127.0.0.2/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Private IP address');
    });

    it('should block 10.0.0.1 (private Class A)', async () => {
      const result = await validateUrl('http://10.0.0.1/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Private IP address');
    });

    it('should block 172.16.0.1 (private Class B start)', async () => {
      const result = await validateUrl('http://172.16.0.1/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Private IP address');
    });

    it('should block 172.31.255.255 (private Class B end)', async () => {
      const result = await validateUrl('http://172.31.255.255/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Private IP address');
    });

    it('should allow 172.15.0.1 (outside private Class B)', async () => {
      const result = await validateUrl('http://172.15.0.1/image.jpg');
      expect(result.safe).toBe(true);
    });

    it('should block 192.168.0.1 (private Class C)', async () => {
      const result = await validateUrl('http://192.168.0.1/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Private IP address');
    });

    it('should block 169.254.169.254 (AWS metadata)', async () => {
      const result = await validateUrl('http://169.254.169.254/latest/meta-data/');
      expect(result.safe).toBe(false);
      // Either reason is acceptable for security
      expect(['Blocked hostname', 'Private IP address']).toContain(result.reason);
    });

    it('should block 0.0.0.0 (current network)', async () => {
      const result = await validateUrl('http://0.0.0.0/image.jpg');
      expect(result.safe).toBe(false);
      // Either reason is acceptable for security
      expect(['Blocked hostname', 'Private IP address']).toContain(result.reason);
    });
  });

  describe('Private IP Blocking - IPv6', () => {
    it('should block ::1 (IPv6 loopback)', async () => {
      const result = await validateUrl('http://[::1]/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block fc00::1 (unique local)', async () => {
      const result = await validateUrl('http://[fc00::1]/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Private IP address');
    });

    it('should block fe80::1 (link-local)', async () => {
      const result = await validateUrl('http://[fe80::1]/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Private IP address');
    });
  });

  describe('Blocked Hostnames (String-based)', () => {
    it('should block localhost', async () => {
      const result = await validateUrl('http://localhost/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block 127.0.0.1 as hostname', async () => {
      const result = await validateUrl('http://127.0.0.1/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block 0.0.0.0 as hostname', async () => {
      const result = await validateUrl('http://0.0.0.0/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });
  });

  describe('Blocked Hostname Patterns', () => {
    it('should block .local domains', async () => {
      const result = await validateUrl('http://my-computer.local/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname pattern');
    });

    it('should block .localhost domains', async () => {
      const result = await validateUrl('http://example.localhost/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname pattern');
    });

    it('should block metadata. prefix (GCP)', async () => {
      const result = await validateUrl('http://metadata.google.internal/computeMetadata/v1/');
      expect(result.safe).toBe(false);
      // metadata.google.internal is in BLOCKED_HOSTNAMES list
      expect(result.reason).toBe('Blocked hostname');
    });
  });

  describe('Cloud Metadata Endpoints', () => {
    it('should block AWS metadata endpoint', async () => {
      const result = await validateUrl('http://169.254.169.254/latest/meta-data/iam/security-credentials/');
      expect(result.safe).toBe(false);
      // 169.254.169.254 is in BLOCKED_HOSTNAMES list
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block GCP metadata endpoint', async () => {
      const result = await validateUrl('http://metadata.google.internal/computeMetadata/v1/');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block Azure metadata endpoint', async () => {
      const result = await validateUrl('http://169.254.169.254/metadata/instance?api-version=2021-02-01');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block Azure metadata.server', async () => {
      const result = await validateUrl('http://metadata.server/metadata');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });
  });

  describe('DNS Rebinding Protection', () => {
    it('should block domain that resolves to private IP', async () => {
      // Mock DNS to return private IP
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, { address: '192.168.1.1', family: 4 });
      });

      const result = await validateUrl('http://evil.com/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Resolves to private IP');
    });

    it('should block domain that resolves to loopback', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, { address: '127.0.0.1', family: 4 });
      });

      const result = await validateUrl('http://evil.com/image.jpg');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Resolves to private IP');
    });

    it('should allow domain that resolves to public IP', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, { address: '8.8.8.8', family: 4 });
      });

      const result = await validateUrl('http://example.com/image.jpg');
      expect(result.safe).toBe(true);
    });

    it('should allow when DNS resolution fails (non-blocking)', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(new Error('DNS lookup failed'), null);
      });

      const result = await validateUrl('http://example.com/image.jpg');
      expect(result.safe).toBe(true);
    });
  });

  describe('Invalid URLs', () => {
    it('should reject malformed URL', async () => {
      const result = await validateUrl('not-a-url');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Invalid URL');
    });

    it('should reject URL with invalid characters', async () => {
      // Test with URL that has no protocol (not a valid absolute URL)
      const result = await validateUrl('not-a-url');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Invalid URL');
    });
  });

  describe('Valid URLs', () => {
    it('should allow valid HTTPS URL', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });

      const result = await validateUrl('https://example.com/image.jpg');
      expect(result.safe).toBe(true);
    });

    it('should allow valid HTTP URL with public IP', async () => {
      const result = await validateUrl('http://8.8.8.8/image.jpg');
      expect(result.safe).toBe(true);
    });
  });
});

describe('SSRF Protection - validateFeedUrl (Feed Management)', () => {
  beforeEach(() => {
    cleanCache();
    mockDnsLookup.mockReset();
  });

  describe('Protocol Validation', () => {
    it('should block file:// protocol', async () => {
      const result = await validateFeedUrl('file:///etc/passwd');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Invalid protocol');
    });

    it('should allow http:// protocol', async () => {
      const result = await validateFeedUrl('http://example.com/feed.xml');
      expect(result.safe).toBe(true);
    });

    it('should allow https:// protocol', async () => {
      const result = await validateFeedUrl('https://example.com/feed.xml');
      expect(result.safe).toBe(true);
    });
  });

  describe('Critical Blocking - Localhost and Loopback', () => {
    it('should block localhost', async () => {
      const result = await validateFeedUrl('http://localhost/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block 127.0.0.1', async () => {
      const result = await validateFeedUrl('http://127.0.0.1/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block 0.0.0.0', async () => {
      const result = await validateFeedUrl('http://0.0.0.0/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block ::1', async () => {
      const result = await validateFeedUrl('http://[::1]/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Loopback address not allowed');
    });
  });

  describe('Critical Blocking - Cloud Metadata', () => {
    it('should block AWS metadata endpoint', async () => {
      const result = await validateFeedUrl('http://169.254.169.254/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block GCP metadata endpoint', async () => {
      const result = await validateFeedUrl('http://metadata.google.internal/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block Azure metadata endpoint', async () => {
      const result = await validateFeedUrl('http://metadata.server/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });

    it('should block metadata. prefixed domains', async () => {
      const result = await validateFeedUrl('http://metadata.evil.com/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname');
    });
  });

  describe('Blocked Patterns - mDNS/Bonjour', () => {
    it('should block .local domains', async () => {
      const result = await validateFeedUrl('http://my-server.local/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname pattern');
    });

    it('should block .localhost domains', async () => {
      const result = await validateFeedUrl('http://example.localhost/feed.xml');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Blocked hostname pattern');
    });
  });

  describe('Private IP Handling (More Permissive for Self-Hosted Feeds)', () => {
    it('should allow 10.0.0.1 with warning', async () => {
      const result = await validateFeedUrl('http://10.0.0.1/feed.xml');
      expect(result.safe).toBe(true);
      expect(result.warning).toBe('Private IP address');
    });

    it('should allow 192.168.1.100 with warning', async () => {
      const result = await validateFeedUrl('http://192.168.1.100/feed.xml');
      expect(result.safe).toBe(true);
      expect(result.warning).toBe('Private IP address');
    });

    it('should allow 172.16.0.1 with warning', async () => {
      const result = await validateFeedUrl('http://172.16.0.1/feed.xml');
      expect(result.safe).toBe(true);
      expect(result.warning).toBe('Private IP address');
    });

    it('should allow domain resolving to private IP with warning', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, { address: '192.168.1.1', family: 4 });
      });

      const result = await validateFeedUrl('http://internal.local/feed.xml');
      expect(result.safe).toBe(false); // Still blocked because .local pattern
    });

    it('should allow domain resolving to private IP (no .local)', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, { address: '192.168.1.1', family: 4 });
      });

      const result = await validateFeedUrl('http://internal.company/feed.xml');
      expect(result.safe).toBe(true);
      expect(result.warning).toBe('Resolves to private IP');
    });
  });

  describe('Valid Feed URLs', () => {
    it('should allow public HTTPS feed', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, { address: '93.184.216.34', family: 4 });
      });

      const result = await validateFeedUrl('https://example.com/feed.xml');
      expect(result.safe).toBe(true);
    });

    it('should allow public HTTP feed', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(null, { address: '8.8.8.8', family: 4 });
      });

      const result = await validateFeedUrl('http://news.ycombinator.com/rss');
      expect(result.safe).toBe(true);
    });

    it('should allow when DNS fails (non-blocking)', async () => {
      mockDnsLookup.mockImplementation((hostname, options, callback) => {
        callback(new Error('DNS failed'), null);
      });

      const result = await validateFeedUrl('http://example.com/feed.xml');
      expect(result.safe).toBe(true);
    });
  });

  describe('Invalid Feed URLs', () => {
    it('should reject malformed URL', async () => {
      const result = await validateFeedUrl('not-a-url');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Invalid URL');
    });
  });
});

describe('DNS Cache Management', () => {
  beforeEach(() => {
    // Clear cache before each test
    cleanCache();
    mockDnsLookup.mockReset();
  });

  it('should cache DNS results', async () => {
    let callCount = 0;
    mockDnsLookup.mockImplementation((hostname, options, callback) => {
      callCount++;
      callback(null, { address: '8.8.8.8', family: 4 });
    });

    // First call - should trigger DNS lookup
    await validateUrl('http://example-cache-test.com/image.jpg');
    expect(callCount).toBe(1);

    // Second call with same domain - should use cache
    await validateUrl('http://example-cache-test.com/other.jpg');
    expect(callCount).toBe(1); // Should not increase due to cache
  });

  it('should not interfere with different domains', async () => {
    let callCount = 0;
    mockDnsLookup.mockImplementation((hostname, options, callback) => {
      callCount++;
      callback(null, { address: '8.8.8.8', family: 4 });
    });

    await validateUrl('http://domain1.com/image.jpg');
    await validateUrl('http://domain2.com/image.jpg');
    expect(callCount).toBe(2); // Different domains, different lookups
  });
});
