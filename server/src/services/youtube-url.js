import fetch from 'node-fetch';

/**
 * Convert various YouTube channel page URLs to their RSS feed URLs
 * Supports:
 * - https://www.youtube.com/c/CHANNEL_NAME
 * - https://www.youtube.com/@HANDLE
 * - https://www.youtube.com/channel/CHANNEL_ID
 * - https://www.youtube.com/user/USERNAME
 */
export async function convertYouTubeUrl(url) {
  // Check if this is a YouTube URL
  const youtubeRegex = /^https?:\/\/(www\.)?youtube\.com\//i;
  if (!youtubeRegex.test(url)) {
    return null;
  }

  // If it's already an RSS feed URL, return as-is
  if (url.includes('/feeds/videos.xml')) {
    return url;
  }

  // Extract channel ID if already in URL
  const channelIdMatch = url.match(/\/channel\/([a-zA-Z0-9_-]{24})/);
  if (channelIdMatch) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdMatch[1]}`;
  }

  // For custom URLs, handles, and usernames, we need to fetch the page
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Try to find channel ID in various places in the HTML
    // Method 1: Look for channelId in JSON data
    const channelIdJsonMatch = html.match(/"channelId":"([^"]+)"/);
    if (channelIdJsonMatch) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdJsonMatch[1]}`;
    }

    // Method 2: Look for externalId in JSON data (alternative format)
    const externalIdMatch = html.match(/"externalId":"([^"]+)"/);
    if (externalIdMatch) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${externalIdMatch[1]}`;
    }

    // Method 3: Look for <meta> tag with channel ID
    const metaMatch = html.match(/<meta\s+itemprop="channelId"\s+content="([^"]+)"/);
    if (metaMatch) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${metaMatch[1]}`;
    }

    // Method 4: Look for og:url which contains channel ID
    const ogUrlMatch = html.match(/<meta\s+property="og:url"\s+content="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/);
    if (ogUrlMatch) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${ogUrlMatch[1]}`;
    }

    // Method 5: Look for canonical link
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/);
    if (canonicalMatch) {
      return `https://www.youtube.com/feeds/videos.xml?channel_id=${canonicalMatch[1]}`;
    }

    throw new Error('Could not extract channel ID from page');
  } catch (error) {
    console.error('Failed to convert YouTube URL:', error.message);
    throw new Error(`Failed to convert YouTube URL to feed: ${error.message}`);
  }
}

/**
 * Check if a URL is a YouTube channel page (not an RSS feed)
 */
export function isYouTubeChannelUrl(url) {
  const youtubeRegex = /^https?:\/\/(www\.)?youtube\.com\//i;
  if (!youtubeRegex.test(url)) {
    return false;
  }

  // It's a channel page if it doesn't have /feeds/ in it
  return !url.includes('/feeds/');
}
