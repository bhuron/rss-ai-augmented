import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// LRU Cache with maximum size to prevent unbounded growth
class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map(); // Map maintains insertion order
  }

  get(key) {
    if (!this.cache.has(key)) return null;

    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Remove existing entry to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end (most recently used)
    this.cache.set(key, value);

    // Evict least recently used (first entry) if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  // For periodic cleanup of expired entries
  cleanExpired(ttl) {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= ttl) {
        this.cache.delete(key);
      }
    }
  }

  get size() {
    return this.cache.size;
  }
}

// DNS cache with LRU eviction and TTL (5 minutes)
const dnsCache = new LRUCache(1000);

// Blocked hostnames (string-based, no DNS needed)
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',            // IPv6 loopback (URL parser returns hostname with brackets)
  '169.254.169.254',  // AWS metadata
  'metadata.google.internal',  // GCP metadata
  'metadata.server',  // Azure metadata
];

// Blocked hostname patterns
const BLOCKED_PATTERNS = [
  '.local',           // Bonjour/mDNS
  '.localhost',
  'metadata.',        // Cloud metadata services
];

/**
 * Check if an IP address is in a private range
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if IP is private/internal
 */
function isPrivateIP(ip) {
  // Handle IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.').map(Number);

    // 127.0.0.0/8 - Loopback
    if (parts[0] === 127) return true;

    // 10.0.0.0/8 - Private Class A
    if (parts[0] === 10) return true;

    // 172.16.0.0/12 - Private Class B
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16 - Private Class C
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 169.254.0.0/16 - Link-local (AWS metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;

    // 0.0.0.0/8 - Current network
    if (parts[0] === 0) return true;

    return false;
  }

  // Handle IPv6
  if (ip.includes(':')) {
    // ::1 - Loopback
    if (ip === '::1') return true;

    // fc00::/7 - Unique local (private)
    const firstTwo = parseInt(ip.substring(0, 2), 16);
    if ((firstTwo & 0xfc) === 0xfc) return true;

    // fe80::/10 - Link-local
    const firstTwoHex = ip.substring(0, 2);
    const firstTwoValue = parseInt(firstTwoHex, 16);
    if ((firstTwoValue & 0xff) === 0xfe && ((firstTwoValue >> 4) & 0x03) === 0x02) return true;

    return false;
  }

  return false;
}

/**
 * Resolve hostname to IP with caching
 * @param {string} hostname - Hostname to resolve
 * @returns {Promise<string|null>} - IP address or null if resolution fails
 */
async function resolveIp(hostname) {
  // Check cache first
  const cached = dnsCache.get(hostname);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.ip;
  }

  try {
    // Resolve hostname (prefer IPv4, fallback to IPv6)
    const result = await dnsLookup(hostname, { family: 0 });

    // Store in cache
    dnsCache.set(hostname, {
      ip: result.address,
      timestamp: Date.now()
    });

    return result.address;
  } catch (error) {
    // DNS resolution failed - this is OK, the image might not load anyway
    // We don't want to block legitimate images due to temporary DNS issues
    // The image fetch will fail naturally with proper error handling
    return null;
  }
}

/**
 * Check if a URL is safe to fetch (not SSRF-vulnerable)
 * @param {string} urlString - URL to check
 * @returns {Promise<{safe: boolean, reason?: string}>}
 */
export async function validateUrl(urlString) {
  try {
    const url = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { safe: false, reason: 'Invalid protocol' };
    }

    const hostname = url.hostname.toLowerCase();

    // Fast checks: blocked hostnames (no DNS needed)
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { safe: false, reason: 'Blocked hostname' };
    }

    // Fast checks: blocked hostname patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (hostname === pattern ||
          hostname.endsWith(pattern) ||
          hostname.startsWith(pattern)) {
        return { safe: false, reason: 'Blocked hostname pattern' };
      }
    }

    // Don't resolve IP addresses - just validate them directly
    // If hostname is already an IP address (IPv4: digits+dots, IPv6: hex+colons)
    const ipToCheck = hostname.replace(/\[|\]/g, '');
    if (/^[\d\[\]:.a-fA-F]+$/.test(ipToCheck)) {
      // It's an IP address, check if private (use version without brackets for IPv6)
      if (isPrivateIP(ipToCheck)) {
        return { safe: false, reason: 'Private IP address' };
      }
      return { safe: true };
    }

    // For domain names, resolve to IP and check
    const ip = await resolveIp(hostname);

    // If DNS resolution fails, allow it (image fetch will fail naturally)
    if (ip === null) {
      return { safe: true };
    }

    // Check if resolved IP is private
    if (isPrivateIP(ip)) {
      return { safe: false, reason: 'Resolves to private IP' };
    }

    return { safe: true };
  } catch (error) {
    // Invalid URL
    return { safe: false, reason: 'Invalid URL' };
  }
}

/**
 * Check if a feed URL is safe (more permissive than validateUrl)
 * Allows private IP ranges for self-hosted feeds, but blocks critical targets
 * @param {string} urlString - URL to check
 * @returns {Promise<{safe: boolean, reason?: string, warning?: string}>}
 */
export async function validateFeedUrl(urlString) {
  try {
    const url = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { safe: false, reason: 'Invalid protocol' };
    }

    const hostname = url.hostname.toLowerCase();

    // CRITICAL: Block localhost and loopback (no legitimate feed use case)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return { safe: false, reason: 'Blocked hostname' };
    }

    // CRITICAL: Block cloud metadata services
    if (hostname === '169.254.169.254' ||
        hostname === 'metadata.google.internal' ||
        hostname === 'metadata.server' ||
        hostname.startsWith('metadata.')) {
      return { safe: false, reason: 'Blocked hostname' };
    }

    // Block .local domains (mDNS/Bonjour - usually not real feeds)
    if (hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
      return { safe: false, reason: 'Blocked hostname pattern' };
    }

    // Check if hostname is an IP address (IPv4: digits+dots, IPv6: hex+colons)
    const ipToCheck = hostname.replace(/\[|\]/g, '');
    if (/^[\d\[\]:.a-fA-F]+$/.test(ipToCheck)) {
      // Allow loopback for self-hosted feeds (but warn)
      if (ipToCheck.startsWith('127.') || ipToCheck === '::1') {
        return { safe: false, reason: 'Loopback address not allowed' };
      }

      // Allow private IPs (self-hosted feeds) but warn
      if (isPrivateIP(ipToCheck)) {
        return { safe: true, warning: 'Private IP address' };
      }

      return { safe: true };
    }

    // For domain names, resolve to IP and check
    const ip = await resolveIp(hostname);

    // If DNS resolution fails, allow it (feed fetch will fail naturally)
    if (ip === null) {
      return { safe: true };
    }

    // Allow private IPs (self-hosted feeds) but warn
    if (isPrivateIP(ip)) {
      return { safe: true, warning: 'Resolves to private IP' };
    }

    return { safe: true };
  } catch (error) {
    // Invalid URL
    return { safe: false, reason: 'Invalid URL' };
  }
}

/**
 * Clear expired cache entries (call periodically)
 */
export function cleanCache() {
  dnsCache.cleanExpired(CACHE_TTL);
}
