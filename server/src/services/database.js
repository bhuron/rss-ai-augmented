// Simple in-memory database using JSON storage
import fs from 'fs';
import path from 'path';

const DB_FILE = 'database.json';

let db = {
  feeds: [],
  articles: [],
  settings: {},
  nextFeedId: 1,
  nextArticleId: 1
};

function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(data);
  }
}

function saveDatabase() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function initDatabase() {
  loadDatabase();
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
    return db.articles.filter(a => ids.includes(a.id));
  },
  insert: (feedId, title, link, content, pubDate, imageUrl = null) => {
    const existing = db.articles.find(a => a.link === link);
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
  cleanup: () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Sort articles by date (newest first)
    const sortedArticles = [...db.articles].sort((a, b) => 
      new Date(b.pub_date) - new Date(a.pub_date)
    );
    
    // Keep the 100 most recent articles
    const recentIds = new Set(sortedArticles.slice(0, 100).map(a => a.id));
    
    const beforeCount = db.articles.length;
    db.articles = db.articles.filter(article => {
      // Always keep if in top 100 most recent
      if (recentIds.has(article.id)) return true;
      
      const articleDate = new Date(article.pub_date);
      
      // Delete read articles older than 10 days
      if (article.is_read && articleDate < tenDaysAgo) return false;
      
      // Delete unread articles older than 30 days
      if (!article.is_read && articleDate < thirtyDaysAgo) return false;
      
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
