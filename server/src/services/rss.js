import Parser from 'rss-parser';
import { articleOps } from './database.js';
import fetch from 'node-fetch';
import iconv from 'iconv-lite';

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail']
  }
});

export async function fetchFeed(feedUrl) {
  try {
    // Fetch the feed manually to handle encoding properly
    const response = await fetch(feedUrl);
    const buffer = await response.arrayBuffer();
    
    // Try to detect encoding from Content-Type header
    const contentType = response.headers.get('content-type') || '';
    let encoding = 'utf-8';
    
    const charsetMatch = contentType.match(/charset=([^;]+)/i);
    if (charsetMatch) {
      encoding = charsetMatch[1].trim();
    }
    
    // Decode the buffer with the correct encoding
    const xmlString = iconv.decode(Buffer.from(buffer), encoding);
    
    // Parse the decoded XML
    const feed = await parser.parseString(xmlString);
    return feed;
  } catch (error) {
    console.error('Error fetching feed:', error);
    // Fallback to default parser
    const feed = await parser.parseURL(feedUrl);
    return feed;
  }
}

export async function syncFeed(feedId, feedUrl) {
  const feed = await fetchFeed(feedUrl);
  
  let newCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;
  
  for (const item of feed.items) {
    // Skip YouTube Shorts (can be disabled by setting INCLUDE_SHORTS=true in .env)
    if (item.link && item.link.includes('/shorts/') && process.env.INCLUDE_SHORTS !== 'true') {
      skippedCount++;
      continue;
    }
    // Extract image from various RSS fields
    let imageUrl = null;
    
    // Check media:group (YouTube uses this)
    if (item['media:group'] && item['media:group']['media:thumbnail']) {
      const thumbnail = item['media:group']['media:thumbnail'];
      imageUrl = thumbnail.$ ? thumbnail.$.url : thumbnail;
    }
    // Check media:thumbnail directly
    else if (item['media:thumbnail']) {
      const thumbnail = item['media:thumbnail'];
      imageUrl = thumbnail.$ ? thumbnail.$.url : thumbnail;
    }
    // Check media:content
    else if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
      imageUrl = item['media:content'].$.url;
    }
    // Check enclosure
    else if (item.enclosure && item.enclosure.type?.startsWith('image/')) {
      imageUrl = item.enclosure.url;
    }
    // Extract from HTML content
    else {
      const contentToCheck = item['content:encoded'] || item.content || item.description || '';
      if (contentToCheck) {
        const imgMatch = contentToCheck.match(/<img[^>]+src=["']([^"'>]+)["']/i);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
      }
    }
    
    // For YouTube videos, construct thumbnail URL from video ID if no thumbnail found
    if (!imageUrl && item.link && (item.link.includes('youtube.com') || item.link.includes('youtu.be'))) {
      const videoIdMatch = item.link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (videoIdMatch) {
        imageUrl = `https://img.youtube.com/vi/${videoIdMatch[1]}/mqdefault.jpg`;
      }
    }
    
    const article = articleOps.insert(
      feedId,
      item.title,
      item.link,
      item.contentSnippet || item.content || '',
      item.pubDate || new Date().toISOString(),
      imageUrl
    );
    if (article) {
      newCount++;
    } else {
      duplicateCount++;
    }
  }

  if (newCount > 0 || skippedCount > 0) {
    console.log(`Feed ${feedId}: ${newCount} new, ${duplicateCount} duplicates, ${skippedCount} skipped`);
  }
  return { newCount, total: feed.items.length };
}
