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
    const article = articleOps.insert(
      feedId,
      item.title,
      item.link,
      item.contentSnippet || item.content || '',
      item.pubDate || new Date().toISOString()
    );
    if (article) newCount++;
  }

  return { newCount, total: feed.items.length };
}
