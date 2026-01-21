// Simple in-memory database using JSON storage
import fs from 'fs';
import path from 'path';
import { normalizeUrl } from '../utils/url.js';

const DB_FILE = 'database.json';

let db = {
  feeds: [],
  articles: [],
  settings: {},
  nextFeedId: 1,
  nextArticleId: 1
};

// Export db for testing (accessed via global.__DB__ in tests)
if (typeof global !== 'undefined') {
  global.__DB__ = db;
}

function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(data);
  }
}

let saveTimeout = null;

function saveDatabase() {
  // If save is already pending, don't schedule another
  if (saveTimeout) return;

  saveTimeout = true;

  // Use setImmediate to schedule the write after all synchronous operations
  setImmediate(() => {
    fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), 'utf8', (err) => {
      saveTimeout = null;
      if (err) {
        console.error('Database save failed:', err);
      }
    });
  });
}

export function initDatabase() {
  loadDatabase();
}

export function shutdownDatabase() {
  return new Promise((resolve, reject) => {
    if (!saveTimeout) {
      resolve();
      return;
    }

    // Wait a bit for any pending save to complete
    setTimeout(() => {
      if (saveTimeout) {
        console.warn('Shutdown: waiting for database save...');
        setTimeout(resolve, 100);
      } else {
        resolve();
      }
    }, 50);
  });
}

// Feed operations
export const feedOps = {
  all: () => db.feeds,
  get: (id) => db.feeds.find(f => f.id === id),
  insert: (title, url) => {
    const feed = { id: db.nextFeedId++, title, url, created_at: new Date().toISOString() };
    db.feeds.push(feed);
    saveDatabase();
    return feed;
  },
  update: (id, title) => {
    const feed = db.feeds.find(f => f.id === id);
    if (feed) {
      feed.title = title;
      saveDatabase();
    }
  },
  delete: (id) => {
    db.feeds = db.feeds.filter(f => f.id !== id);
    db.articles = db.articles.filter(a => a.feed_id !== id);
    saveDatabase();
  }
};

// Article operations
export const articleOps = {
  all: (feedId = null, unreadOnly = false) => {
    let articles = db.articles;
    if (feedId) articles = articles.filter(a => a.feed_id === feedId);
    if (unreadOnly) articles = articles.filter(a => !a.is_read);
    return articles.map(a => ({
      ...a,
      feed_title: db.feeds.find(f => f.id === a.feed_id)?.title || 'Unknown'
    })).sort((a, b) => new Date(b.pub_date) - new Date(a.pub_date));
  },
  getByIds: (ids) => {
    return db.articles.filter(a => ids.includes(a.id)).map(a => ({
      ...a,
      feed_title: db.feeds.find(f => f.id === a.feed_id)?.title || 'Unknown'
    }));
  },
  insert: (feedId, title, link, content, pubDate, imageUrl = null) => {
    const normalizeTitle = (t) => t.trim().toLowerCase().replace(/\s+/g, ' ');

    const normalizedLink = normalizeUrl(link);
    const normalizedTitle = normalizeTitle(title);

    // Check for duplicates within the same feed only
    const existing = db.articles.find(a => {
      if (a.feed_id !== feedId) return false;

      const existingLink = normalizeUrl(a.link);
      const existingTitle = normalizeTitle(a.title);
      
      return existingLink === normalizedLink || existingTitle === normalizedTitle;
    });
    
    if (existing) return null;
    
    const article = {
      id: db.nextArticleId++,
      feed_id: feedId,
      title,
      link,
      content,
      pub_date: pubDate,
      image_url: imageUrl,
      is_read: false,
      is_saved: false,
      created_at: new Date().toISOString()
    };
    db.articles.push(article);
    saveDatabase();
    return article;
  },
  updateRead: (id, isRead) => {
    const article = db.articles.find(a => a.id === id);
    if (article) {
      article.is_read = isRead;
      saveDatabase();
    }
  },
  updateSaved: (id, isSaved) => {
    const article = db.articles.find(a => a.id === id);
    if (article) {
      article.is_saved = isSaved;
      saveDatabase();
    }
  },
  cleanup: () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    // Sort articles by date (newest first)
    const sortedArticles = [...db.articles].sort((a, b) => 
      new Date(b.pub_date) - new Date(a.pub_date)
    );
    
    // Keep the 200 most recent articles per feed to avoid re-syncing old articles
    const recentIdsByFeed = new Map();
    sortedArticles.forEach(article => {
      if (!recentIdsByFeed.has(article.feed_id)) {
        recentIdsByFeed.set(article.feed_id, []);
      }
      const feedArticles = recentIdsByFeed.get(article.feed_id);
      if (feedArticles.length < 200) {
        feedArticles.push(article.id);
      }
    });
    const recentIds = new Set([...recentIdsByFeed.values()].flat());
    
    const beforeCount = db.articles.length;
    db.articles = db.articles.filter(article => {
      // Never delete saved articles
      if (article.is_saved) return true;
      
      // Always keep if in top 200 per feed (prevents re-syncing from RSS)
      if (recentIds.has(article.id)) return true;
      
      const articleDate = new Date(article.pub_date);
      
      // Delete read articles older than 30 days (increased from 10)
      if (article.is_read && articleDate < thirtyDaysAgo) return false;
      
      // Delete unread articles older than 60 days (increased from 30)
      if (!article.is_read && articleDate < sixtyDaysAgo) return false;
      
      // Keep everything else
      return true;
    });
    
    const deleted = beforeCount - db.articles.length;
    if (deleted > 0) {
      saveDatabase();
      console.log(`Cleaned up ${deleted} old articles`);
    }
    
    return deleted;
  }
};

// Settings operations
export const settingsOps = {
  get: (key) => db.settings[key],
  getAll: (prefix) => {
    const result = {};
    Object.keys(db.settings).forEach(key => {
      if (key.startsWith(prefix)) {
        result[key] = db.settings[key];
      }
    });
    return result;
  },
  set: (key, value) => {
    db.settings[key] = value;
    saveDatabase();
  }
};

export default { feedOps, articleOps, settingsOps };
