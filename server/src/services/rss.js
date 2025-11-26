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
  for (const item of feed.items) {
    // Extract image from various RSS fields
    let imageUrl = null;
    if (item.enclosure && item.enclosure.type?.startsWith('image/')) {
      imageUrl = item.enclosure.url;
    } else if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
      imageUrl = item['media:content'].$.url;
    } else if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
      imageUrl = item['media:thumbnail'].$.url;
    } else {
      // Try to extract first image from HTML content (check multiple fields)
      const contentToCheck = item['content:encoded'] || item.content || item.description || '';
      if (contentToCheck) {
        const imgMatch = contentToCheck.match(/<img[^>]+src=["']([^"'>]+)["']/i);
        if (imgMatch) {
          imageUrl = imgMatch[1];
        }
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
    if (article) newCount++;
  }

  return { newCount, total: feed.items.length };
}
