import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';

// Mock fs module before importing database
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(),
    writeFile: vi.fn((file, data, encoding, callback) => {
      callback(null);
    }),
  },
}));

// Import database functions after mocking fs
import { feedOps, articleOps, settingsOps, initDatabase, shutdownDatabase } from '../../../src/services/database.js';

describe('Database - Feed Operations', () => {
  beforeEach(() => {
    // Reset database state before each test
    const db = global.__DB__;
    db.feeds = [];
    db.articles = [];
    db.settings = {};
    db.nextFeedId = 1;
    db.nextArticleId = 1;

    vi.clearAllMocks();
  });

  describe('feedOps.all', () => {
    it('should return empty array when no feeds exist', () => {
      const feeds = feedOps.all();
      expect(feeds).toEqual([]);
    });

    it('should return all feeds', () => {
      feedOps.insert('Feed 1', 'https://example.com/feed1.xml');
      feedOps.insert('Feed 2', 'https://example.com/feed2.xml');

      const feeds = feedOps.all();
      expect(feeds).toHaveLength(2);
      expect(feeds[0].title).toBe('Feed 1');
      expect(feeds[1].title).toBe('Feed 2');
    });
  });

  describe('feedOps.get', () => {
    it('should return feed by id', () => {
      const feed = feedOps.insert('Test Feed', 'https://example.com/feed.xml');
      const found = feedOps.get(feed.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(feed.id);
      expect(found.title).toBe('Test Feed');
    });

    it('should return undefined for non-existent feed', () => {
      const found = feedOps.get(999);
      expect(found).toBeUndefined();
    });
  });

  describe('feedOps.insert', () => {
    it('should insert new feed with auto-incrementing id', () => {
      const feed1 = feedOps.insert('Feed 1', 'https://example.com/feed1.xml');
      const feed2 = feedOps.insert('Feed 2', 'https://example.com/feed2.xml');

      expect(feed1.id).toBe(1);
      expect(feed2.id).toBe(2);
      expect(feed1.title).toBe('Feed 1');
      expect(feed1.url).toBe('https://example.com/feed1.xml');
      expect(feed1.created_at).toBeDefined();
    });

    it('should trigger database save', async () => {
      feedOps.insert('Test Feed', 'https://example.com/feed.xml');
      await new Promise(resolve => setImmediate(resolve));
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('feedOps.update', () => {
    it('should update feed title', () => {
      const feed = feedOps.insert('Old Title', 'https://example.com/feed.xml');
      feedOps.update(feed.id, 'New Title');

      const updated = feedOps.get(feed.id);
      expect(updated.title).toBe('New Title');
    });

    it('should not crash when updating non-existent feed', () => {
      expect(() => feedOps.update(999, 'New Title')).not.toThrow();
    });

    it('should trigger database save', async () => {
      const feed = feedOps.insert('Test Feed', 'https://example.com/feed.xml');
      vi.clearAllMocks();

      feedOps.update(feed.id, 'Updated');
      await new Promise(resolve => setImmediate(resolve));
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('feedOps.delete', () => {
    it('should delete feed and its articles', () => {
      const feed = feedOps.insert('Test Feed', 'https://example.com/feed.xml');
      articleOps.insert(feed.id, 'Article 1', 'https://example.com/article1', 'Content', new Date().toISOString());
      articleOps.insert(feed.id, 'Article 2', 'https://example.com/article2', 'Content', new Date().toISOString());

      feedOps.delete(feed.id);

      expect(feedOps.all()).toHaveLength(0);
      expect(articleOps.all()).toHaveLength(0);
    });

    it('should not affect other feeds', () => {
      const feed1 = feedOps.insert('Feed 1', 'https://example.com/feed1.xml');
      const feed2 = feedOps.insert('Feed 2', 'https://example.com/feed2.xml');

      articleOps.insert(feed1.id, 'Article 1', 'https://example.com/article1', 'Content', new Date().toISOString());
      articleOps.insert(feed2.id, 'Article 2', 'https://example.com/article2', 'Content', new Date().toISOString());

      feedOps.delete(feed1.id);

      expect(feedOps.all()).toHaveLength(1);
      expect(feedOps.get(feed2.id)).toBeDefined();
      expect(articleOps.all()).toHaveLength(1);
    });

    it('should trigger database save', async () => {
      const feed = feedOps.insert('Test Feed', 'https://example.com/feed.xml');
      vi.clearAllMocks();

      feedOps.delete(feed.id);
      await new Promise(resolve => setImmediate(resolve));
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});

describe('Database - Article Operations', () => {
  let feed;

  beforeEach(() => {
    // Reset database state
    const db = global.__DB__;
    db.feeds = [];
    db.articles = [];
    db.settings = {};
    db.nextFeedId = 1;
    db.nextArticleId = 1;

    feed = feedOps.insert('Test Feed', 'https://example.com/feed.xml');
    vi.clearAllMocks();
  });

  describe('articleOps.all', () => {
    it('should return empty array when no articles exist', () => {
      const articles = articleOps.all();
      expect(articles).toEqual([]);
    });

    it('should return all articles sorted by pub_date (newest first)', () => {
      const now = new Date();
      const article1 = articleOps.insert(feed.id, 'Article 1', 'https://example.com/a1', 'Content 1', new Date(now - 2000).toISOString());
      const article2 = articleOps.insert(feed.id, 'Article 2', 'https://example.com/a2', 'Content 2', new Date(now - 1000).toISOString());
      const article3 = articleOps.insert(feed.id, 'Article 3', 'https://example.com/a3', 'Content 3', now.toISOString());

      const articles = articleOps.all();
      expect(articles).toHaveLength(3);
      expect(articles[0].id).toBe(article3.id); // Newest
      expect(articles[1].id).toBe(article2.id);
      expect(articles[2].id).toBe(article1.id); // Oldest
    });

    it('should filter by feed_id', () => {
      const feed2 = feedOps.insert('Feed 2', 'https://example.com/feed2.xml');
      articleOps.insert(feed.id, 'Article 1', 'https://example.com/a1', 'Content', new Date().toISOString());
      articleOps.insert(feed2.id, 'Article 2', 'https://example.com/a2', 'Content', new Date().toISOString());

      const feed1Articles = articleOps.all(feed.id);
      const feed2Articles = articleOps.all(feed2.id);

      expect(feed1Articles).toHaveLength(1);
      expect(feed2Articles).toHaveLength(1);
      expect(feed1Articles[0].title).toBe('Article 1');
      expect(feed2Articles[0].title).toBe('Article 2');
    });

    it('should filter by unread status', () => {
      const a1 = articleOps.insert(feed.id, 'Article 1', 'https://example.com/a1', 'Content', new Date().toISOString());
      const a2 = articleOps.insert(feed.id, 'Article 2', 'https://example.com/a2', 'Content', new Date().toISOString());
      const a3 = articleOps.insert(feed.id, 'Article 3', 'https://example.com/a3', 'Content', new Date().toISOString());

      articleOps.updateRead(a2.id, true);

      const unread = articleOps.all(null, true);
      expect(unread).toHaveLength(2);
      expect(unread.find(a => a.id === a1.id)).toBeDefined();
      expect(unread.find(a => a.id === a2.id)).toBeUndefined();
      expect(unread.find(a => a.id === a3.id)).toBeDefined();
    });

    it('should include feed_title in results', () => {
      articleOps.insert(feed.id, 'Article 1', 'https://example.com/a1', 'Content', new Date().toISOString());

      const articles = articleOps.all();
      expect(articles[0].feed_title).toBe('Test Feed');
    });

    it('should show Unknown for articles with deleted feeds', () => {
      const a1 = articleOps.insert(feed.id, 'Article 1', 'https://example.com/a1', 'Content', new Date().toISOString());

      // Manually remove feed to simulate orphaned article scenario
      const db = global.__DB__;
      db.feeds = db.feeds.filter(f => f.id !== feed.id);

      const articles = articleOps.all();
      expect(articles[0].feed_title).toBe('Unknown');
    });
  });

  describe('articleOps.getByIds', () => {
    it('should return articles by ids', () => {
      const a1 = articleOps.insert(feed.id, 'Article 1', 'https://example.com/a1', 'Content', new Date().toISOString());
      const a2 = articleOps.insert(feed.id, 'Article 2', 'https://example.com/a2', 'Content', new Date().toISOString());
      const a3 = articleOps.insert(feed.id, 'Article 3', 'https://example.com/a3', 'Content', new Date().toISOString());

      const articles = articleOps.getByIds([a1.id, a3.id]);
      expect(articles).toHaveLength(2);
      expect(articles.find(a => a.id === a1.id)).toBeDefined();
      expect(articles.find(a => a.id === a2.id)).toBeUndefined();
      expect(articles.find(a => a.id === a3.id)).toBeDefined();
    });

    it('should return empty array for non-existent ids', () => {
      const articles = articleOps.getByIds([999, 1000]);
      expect(articles).toHaveLength(0);
    });

    it('should include feed_title', () => {
      const a1 = articleOps.insert(feed.id, 'Article 1', 'https://example.com/a1', 'Content', new Date().toISOString());
      const articles = articleOps.getByIds([a1.id]);
      expect(articles[0].feed_title).toBe('Test Feed');
    });
  });

  describe('articleOps.insert - Duplicate Detection', () => {
    it('should detect duplicate by normalized URL (same feed)', () => {
      const url1 = 'https://example.com/article?utm_source=twitter';
      const url2 = 'https://example.com/article?utm_source=facebook';

      const a1 = articleOps.insert(feed.id, 'Article 1', url1, 'Content', new Date().toISOString());
      const a2 = articleOps.insert(feed.id, 'Article 2', url2, 'Content', new Date().toISOString());

      expect(a1).toBeDefined();
      expect(a2).toBeNull(); // Duplicate detected
    });

    it('should detect duplicate by normalized title (same feed)', () => {
      const a1 = articleOps.insert(feed.id, '  Test  Article  ', 'https://example.com/a1', 'Content', new Date().toISOString());
      const a2 = articleOps.insert(feed.id, 'TEST ARTICLE', 'https://example.com/a2', 'Content', new Date().toISOString());

      expect(a1).toBeDefined();
      expect(a2).toBeNull(); // Duplicate detected (title normalization)
    });

    it('should allow same URL in different feeds', () => {
      const feed2 = feedOps.insert('Feed 2', 'https://example.com/feed2.xml');
      const url = 'https://example.com/article';

      const a1 = articleOps.insert(feed.id, 'Article 1', url, 'Content', new Date().toISOString());
      const a2 = articleOps.insert(feed2.id, 'Article 2', url, 'Content', new Date().toISOString());

      expect(a1).toBeDefined();
      expect(a2).toBeDefined();
      expect(a1.id).not.toBe(a2.id);
    });

    it('should allow same title in different feeds', () => {
      const feed2 = feedOps.insert('Feed 2', 'https://example.com/feed2.xml');

      const a1 = articleOps.insert(feed.id, 'Same Title', 'https://example.com/a1', 'Content', new Date().toISOString());
      const a2 = articleOps.insert(feed2.id, 'Same Title', 'https://example.com/a2', 'Content', new Date().toISOString());

      expect(a1).toBeDefined();
      expect(a2).toBeDefined();
    });

    it('should create article with correct fields', () => {
      const pubDate = new Date().toISOString();
      const article = articleOps.insert(
        feed.id,
        'Test Article',
        'https://example.com/article',
        '<p>Content</p>',
        pubDate,
        'https://example.com/image.jpg'
      );

      expect(article.id).toBeDefined();
      expect(article.feed_id).toBe(feed.id);
      expect(article.title).toBe('Test Article');
      expect(article.link).toBe('https://example.com/article');
      expect(article.content).toBe('<p>Content</p>');
      expect(article.pub_date).toBe(pubDate);
      expect(article.image_url).toBe('https://example.com/image.jpg');
      expect(article.is_read).toBe(false);
      expect(article.is_saved).toBe(false);
      expect(article.created_at).toBeDefined();
    });

    it('should handle missing image_url', () => {
      const article = articleOps.insert(
        feed.id,
        'Test Article',
        'https://example.com/article',
        'Content',
        new Date().toISOString()
      );

      expect(article.image_url).toBeNull();
    });

    it('should trigger database save', async () => {
      articleOps.insert(feed.id, 'Article', 'https://example.com/a', 'Content', new Date().toISOString());
      await new Promise(resolve => setImmediate(resolve));
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('articleOps.updateRead', () => {
    it('should mark article as read', () => {
      const article = articleOps.insert(feed.id, 'Article', 'https://example.com/a', 'Content', new Date().toISOString());

      articleOps.updateRead(article.id, true);

      const updated = articleOps.all().find(a => a.id === article.id);
      expect(updated.is_read).toBe(true);
    });

    it('should mark article as unread', () => {
      const article = articleOps.insert(feed.id, 'Article', 'https://example.com/a', 'Content', new Date().toISOString());
      articleOps.updateRead(article.id, true);
      articleOps.updateRead(article.id, false);

      const updated = articleOps.all().find(a => a.id === article.id);
      expect(updated.is_read).toBe(false);
    });

    it('should not crash when updating non-existent article', () => {
      expect(() => articleOps.updateRead(999, true)).not.toThrow();
    });

    it('should trigger database save', async () => {
      const article = articleOps.insert(feed.id, 'Article', 'https://example.com/a', 'Content', new Date().toISOString());
      vi.clearAllMocks();

      articleOps.updateRead(article.id, true);
      await new Promise(resolve => setImmediate(resolve));
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('articleOps.updateSaved', () => {
    it('should mark article as saved', () => {
      const article = articleOps.insert(feed.id, 'Article', 'https://example.com/a', 'Content', new Date().toISOString());

      articleOps.updateSaved(article.id, true);

      const updated = articleOps.all().find(a => a.id === article.id);
      expect(updated.is_saved).toBe(true);
    });

    it('should unmark article as saved', () => {
      const article = articleOps.insert(feed.id, 'Article', 'https://example.com/a', 'Content', new Date().toISOString());
      articleOps.updateSaved(article.id, true);
      articleOps.updateSaved(article.id, false);

      const updated = articleOps.all().find(a => a.id === article.id);
      expect(updated.is_saved).toBe(false);
    });

    it('should not crash when updating non-existent article', () => {
      expect(() => articleOps.updateSaved(999, true)).not.toThrow();
    });

    it('should trigger database save', async () => {
      const article = articleOps.insert(feed.id, 'Article', 'https://example.com/a', 'Content', new Date().toISOString());
      vi.clearAllMocks();

      articleOps.updateSaved(article.id, true);
      await new Promise(resolve => setImmediate(resolve));
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('articleOps.cleanup - Retention Policies', () => {
    it('should keep saved articles forever', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago

      const article = articleOps.insert(feed.id, 'Old Article', 'https://example.com/old', 'Content', oldDate.toISOString());
      articleOps.updateSaved(article.id, true);

      const deleted = articleOps.cleanup();

      expect(deleted).toBe(0);
      const articles = articleOps.all();
      expect(articles).toHaveLength(1);
      expect(articles[0].is_saved).toBe(true);
    });

    it('should delete read articles older than 30 days', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      // Insert 250 old articles and 1 recent to exceed top 200 limit
      for (let i = 0; i < 250; i++) {
        articleOps.insert(feed.id, `Old Read ${i}`, `https://example.com/o${i}`, 'Content', oldDate.toISOString());
      }
      const recent = articleOps.insert(feed.id, 'Recent Read', 'https://example.com/recent', 'Content', recentDate.toISOString());

      // Mark all as read
      const all = articleOps.all();
      all.forEach(a => articleOps.updateRead(a.id, true));

      const deleted = articleOps.cleanup();

      // Should delete 51 old articles (251 total - 200 kept = 51 deleted)
      expect(deleted).toBe(51);
      const articles = articleOps.all();
      expect(articles).toHaveLength(200); // 200 kept (some old + recent)
      expect(articles.find(a => a.id === recent.id)).toBeDefined();
    });

    it('should delete unread articles older than 60 days', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 61 * 24 * 60 * 60 * 1000); // 61 days ago
      const recentDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      // Insert 250 old unread articles to exceed top 200 limit
      for (let i = 0; i < 250; i++) {
        articleOps.insert(feed.id, `Old Unread ${i}`, `https://example.com/o${i}`, 'Content', oldDate.toISOString());
      }
      const recent = articleOps.insert(feed.id, 'Recent Unread', 'https://example.com/recent', 'Content', recentDate.toISOString());

      const deleted = articleOps.cleanup();

      // Should delete 51 old articles (251 total - 200 kept = 51 deleted)
      expect(deleted).toBe(51);
      const articles = articleOps.all();
      expect(articles).toHaveLength(200); // 200 kept (some old + recent)
      expect(articles.find(a => a.id === recent.id)).toBeDefined();
    });

    it('should keep top 200 articles per feed', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

      // Insert 250 articles, all old and read
      for (let i = 0; i < 250; i++) {
        const article = articleOps.insert(feed.id, `Article ${i}`, `https://example.com/a${i}`, 'Content', oldDate.toISOString());
        articleOps.updateRead(article.id, true);
      }

      const deleted = articleOps.cleanup();

      // Should keep 200 most recent (all inserted same day, but first 200 kept)
      expect(deleted).toBe(50);
      const articles = articleOps.all();
      expect(articles).toHaveLength(200);
    });

    it('should handle multiple feeds independently for top 200', () => {
      const feed2 = feedOps.insert('Feed 2', 'https://example.com/feed2.xml');
      const now = new Date();
      const oldDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Insert 250 articles in each feed
      for (let i = 0; i < 250; i++) {
        let a = articleOps.insert(feed.id, `F1-A${i}`, `https://example.com/f1a${i}`, 'Content', oldDate.toISOString());
        articleOps.updateRead(a.id, true);
        a = articleOps.insert(feed2.id, `F2-A${i}`, `https://example.com/f2a${i}`, 'Content', oldDate.toISOString());
        articleOps.updateRead(a.id, true);
      }

      articleOps.cleanup();

      // Should keep 200 per feed = 400 total
      const articles = articleOps.all();
      expect(articles).toHaveLength(400);

      const feed1Articles = articleOps.all(feed.id);
      const feed2Articles = articleOps.all(feed2.id);
      expect(feed1Articles).toHaveLength(200);
      expect(feed2Articles).toHaveLength(200);
    });

    it('should not delete recent unread articles', () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      articleOps.insert(feed.id, 'Recent Unread', 'https://example.com/recent', 'Content', recentDate.toISOString());

      const deleted = articleOps.cleanup();

      expect(deleted).toBe(0);
      expect(articleOps.all()).toHaveLength(1);
    });

    it('should return number of deleted articles', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 61 * 24 * 60 * 60 * 1000);

      // Insert 250 articles to exceed the "top 200" limit
      for (let i = 0; i < 250; i++) {
        articleOps.insert(feed.id, `Old ${i}`, `https://example.com/o${i}`, 'Content', oldDate.toISOString());
      }

      const deleted = articleOps.cleanup();

      // Should delete 50 articles (250 - 200 = 50), even though they're old
      // because top 200 are kept
      expect(deleted).toBe(50);
    });

    it('should trigger database save when articles are deleted', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 61 * 24 * 60 * 60 * 1000);

      articleOps.insert(feed.id, 'Old', 'https://example.com/old', 'Content', oldDate.toISOString());
      vi.clearAllMocks();

      articleOps.cleanup();
      await new Promise(resolve => setImmediate(resolve));

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should not trigger database save when no articles deleted', async () => {
      const now = new Date();
      // Insert only 199 articles (under the 200 limit)
      for (let i = 0; i < 199; i++) {
        articleOps.insert(feed.id, `Recent ${i}`, `https://example.com/r${i}`, 'Content', now.toISOString());
      }

      // Wait for all pending saves from inserts to complete
      await new Promise(resolve => setImmediate(resolve));
      vi.clearAllMocks();

      articleOps.cleanup();
      await new Promise(resolve => setImmediate(resolve));

      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});

describe('Database - Settings Operations', () => {
  beforeEach(() => {
    const db = global.__DB__;
    db.settings = {};
    vi.clearAllMocks();
  });

  describe('settingsOps.get', () => {
    it('should return setting value', () => {
      settingsOps.set('test_key', 'test_value');
      expect(settingsOps.get('test_key')).toBe('test_value');
    });

    it('should return undefined for non-existent setting', () => {
      expect(settingsOps.get('nonexistent')).toBeUndefined();
    });
  });

  describe('settingsOps.getAll', () => {
    it('should return all settings with prefix', () => {
      settingsOps.set('llm_provider', 'openai');
      settingsOps.set('llm_apiKey', 'sk-xxx');
      settingsOps.set('llm_model', 'gpt-4');
      settingsOps.set('other_setting', 'value');

      const llmSettings = settingsOps.getAll('llm_');

      expect(llmSettings).toEqual({
        llm_provider: 'openai',
        llm_apiKey: 'sk-xxx',
        llm_model: 'gpt-4'
      });
      expect(llmSettings.other_setting).toBeUndefined();
    });

    it('should return empty object when no settings match prefix', () => {
      settingsOps.set('other_setting', 'value');

      const result = settingsOps.getAll('llm_');
      expect(result).toEqual({});
    });

    it('should return empty object when no settings exist', () => {
      const result = settingsOps.getAll('llm_');
      expect(result).toEqual({});
    });
  });

  describe('settingsOps.set', () => {
    it('should set setting value', () => {
      settingsOps.set('test_key', 'test_value');
      expect(settingsOps.get('test_key')).toBe('test_value');
    });

    it('should update existing setting', () => {
      settingsOps.set('test_key', 'value1');
      settingsOps.set('test_key', 'value2');
      expect(settingsOps.get('test_key')).toBe('value2');
    });

    it('should schedule database save', async () => {
      settingsOps.set('test_key', 'test_value');

      // Wait for setImmediate to execute
      await new Promise(resolve => setImmediate(resolve));

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});

describe('Database - Initialization and Shutdown', () => {
  beforeEach(() => {
    // Reset database state
    const db = global.__DB__;
    db.feeds = [];
    db.articles = [];
    db.settings = {};
    db.nextFeedId = 1;
    db.nextArticleId = 1;
    vi.clearAllMocks();
  });

  it('should initialize with empty database when file does not exist', () => {
    fs.existsSync.mockReturnValue(false);

    initDatabase();

    expect(feedOps.all()).toEqual([]);
    expect(articleOps.all()).toEqual([]);
  });

  it('should load existing database from file', () => {
    const existingDb = {
      feeds: [{ id: 1, title: 'Test Feed', url: 'https://example.com/feed.xml', created_at: new Date().toISOString() }],
      articles: [],
      settings: { test: 'value' },
      nextFeedId: 2,
      nextArticleId: 1
    };

    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(existingDb));

    initDatabase();

    const feeds = feedOps.all();
    expect(feeds).toHaveLength(1);
    expect(feeds[0].title).toBe('Test Feed');
  });

  it('should handle shutdown gracefully', async () => {
    await expect(shutdownDatabase()).resolves.not.toThrow();
  });
});
