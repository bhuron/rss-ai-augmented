import Parser from 'rss-parser';
import { articleOps } from './database.js';

const parser = new Parser();

export async function fetchFeed(feedUrl) {
  const feed = await parser.parseURL(feedUrl);
  return feed;
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
    } else if (item.content) {
      // Try to extract first image from HTML content
      const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
      if (imgMatch) imageUrl = imgMatch[1];
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
