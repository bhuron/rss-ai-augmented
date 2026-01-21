import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { useFeedOperations } from './hooks/useFeedOperations.js';
import { useArticleOperations } from './hooks/useArticleOperations.js';
import FeedList from './components/FeedList';
import ArticleList from './components/ArticleList';
import Toolbar from './components/Toolbar';
const SettingsModal = lazy(() => import('./components/SettingsModal'));

function App() {
  // Feed operations hook
  const { feeds, fetchFeeds, addFeed, deleteFeed, syncFeed, renameFeed, exportFeeds, importFeeds } = useFeedOperations();

  const [articles, setArticles] = useState([]);
  const [allArticles, setAllArticles] = useState([]); // Store all articles for counts
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [categories, setCategories] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Article operations hook
  const { markAsRead, toggleSaved, markAllAsRead } = useArticleOperations({
    setArticles,
    setAllArticles,
    articles
  });

  const handleSelectFeed = useCallback((feedId) => {
    setSelectedFeed(feedId);
    setShowSavedOnly(false);
  }, []);

  const handleSelectSaved = useCallback(() => {
    setSelectedFeed(null);
    setShowSavedOnly(true);
  }, []);

  useEffect(() => {
    fetchFeeds();
    // Sync on app load and refresh articles after
    syncAllFeeds().then(() => {
      fetchArticles();
    });
  }, []);

  useEffect(() => {
    // Auto-refresh every 15 minutes
    const interval = setInterval(() => {
      syncAllFeeds();
    }, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [selectedFeed, showUnreadOnly, showSavedOnly]); // Recreate interval when filters change

  useEffect(() => {
    // Global keyboard shortcuts
    const handleKeyDown = async (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'c' && categories) {
        e.preventDefault();
        setCategories(null);
        // Re-fetch to restore chronological order
        const params = new URLSearchParams();
        if (selectedFeed) params.append('feedId', selectedFeed);
        if (showUnreadOnly && !showSavedOnly) params.append('unreadOnly', 'true');
        
        fetch(`/api/articles?${params}`)
          .then(res => res.json())
          .then(data => {
            let filtered = data;
            if (showSavedOnly) {
              filtered = data.filter(a => a.is_saved);
            }
            if (selectedFeed) {
              filtered = filtered.filter(a => a.feed_id === selectedFeed);
            }
            setArticles(filtered);
          });
      } else if (e.key === 'r') {
        e.preventDefault();
        await syncAllFeeds(true);
      } else if (e.key === 'a') {
        e.preventDefault();
        handleSelectFeed(null);
      } else if (e.key === 'l') {
        e.preventDefault();
        handleSelectSaved();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categories, selectedFeed, showUnreadOnly, showSavedOnly]);



  const fetchArticles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedFeed) params.append('feedId', selectedFeed);
      // Don't apply unread filter when showing saved articles
      if (showUnreadOnly && !showSavedOnly) params.append('unreadOnly', 'true');

      // Fetch both filtered and all articles in parallel
      const [res, allRes] = await Promise.all([
        fetch(`/api/articles?${params}`),
        fetch('/api/articles')
      ]);

      let data = await res.json();
      const allData = await allRes.json();

      // Filter for saved articles on client side (always show all saved, read or unread)
      if (showSavedOnly) {
        data = data.filter(a => a.is_saved);
      }

      // Double-check client-side filtering to ensure no wrong articles slip through
      if (selectedFeed) {
        data = data.filter(a => a.feed_id === selectedFeed);
      }

      setArticles(data);
      setAllArticles(allData);
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    }
  }, [selectedFeed, showUnreadOnly, showSavedOnly]);

  useEffect(() => {
    setCategories(null); // Clear categories when filter changes
    fetchArticles();
  }, [fetchArticles]);

  const syncAllFeeds = useCallback(async (userInitiated = false) => {
    setSyncing(true);
    try {
      const response = await fetch('/api/feeds/sync-all', { method: 'POST' });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.type === 'progress') {
              // Update articles progressively as feeds complete
              const allRes = await fetch('/api/articles');
              const allData = await allRes.json();
              setAllArticles(allData);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      // Final update - refresh all articles for sidebar counts
      const allRes = await fetch('/api/articles');
      const allData = await allRes.json();
      setAllArticles(allData);

      // If user-initiated (pressed 'r'), also refresh the visible article list
      if (userInitiated) {
        await fetchArticles();
      }

    } catch (error) {
      console.error('Failed to sync feeds:', error);
    } finally {
      setSyncing(false);
    }
  }, [fetchArticles]);

  // Calculate unread counts per feed
  const unreadCounts = React.useMemo(() => {
    const counts = { total: 0 };
    allArticles.forEach(article => {
      if (!article.is_read) {
        counts.total++;
        counts[article.feed_id] = (counts[article.feed_id] || 0) + 1;
      }
    });
    return counts;
  }, [allArticles]);

  const sortByAI = useCallback(async () => {
    const MAX_ARTICLES = 100;
    const MAX_PER_FEED = 10;
    
    // Balance articles across feeds to prevent high-volume feeds from dominating
    const articlesByFeed = new Map();
    articles.forEach(article => {
      if (!articlesByFeed.has(article.feed_id)) {
        articlesByFeed.set(article.feed_id, []);
      }
      articlesByFeed.get(article.feed_id).push(article);
    });
    
    // Take max 10 articles per feed, then fill up to 100 total
    let articlesToSort = [];
    articlesByFeed.forEach(feedArticles => {
      articlesToSort.push(...feedArticles.slice(0, MAX_PER_FEED));
    });
    
    // If we have room, add more articles from feeds that had more
    if (articlesToSort.length < MAX_ARTICLES) {
      const remaining = articles.filter(a => !articlesToSort.includes(a));
      articlesToSort.push(...remaining.slice(0, MAX_ARTICLES - articlesToSort.length));
    } else {
      articlesToSort = articlesToSort.slice(0, MAX_ARTICLES);
    }
    
    const remainingArticles = articles.filter(a => !articlesToSort.includes(a));
    
    if (articlesToSort.length === 0) return;
    
    // Show loading indicator
    setLoading(true);
    
    // Start AI sorting in background
    try {
      
      const res = await fetch('/api/ai/sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          articleIds: articlesToSort.map(a => a.id),
          criteria: 'relevance and importance'
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to sort articles');
      }
      
      const result = await res.json();
      
      if (!result.articles || !Array.isArray(result.articles)) {
        throw new Error('Invalid response from server');
      }
      
      // Update with AI-sorted results when ready
      const allArticles = [...result.articles, ...remainingArticles];
      
      setArticles(allArticles);
      setCategories(result.categories);
    } catch (error) {
      console.error('AI sorting error:', error);
      alert('AI sorting failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [articles]);

  const generateDigest = useCallback(async () => {
    const MAX_ARTICLES = 30;
    
    if (articles.length > MAX_ARTICLES) {
      const proceed = confirm(
        `You have ${articles.length} articles. Digest works best with fewer articles.\n\n` +
        `Generate digest for the first ${MAX_ARTICLES} articles only?`
      );
      if (!proceed) return;
    }
    
    setLoading(true);
    try {
      const articlesToDigest = articles.slice(0, MAX_ARTICLES);
      
      const res = await fetch('/api/ai/digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleIds: articlesToDigest.map(a => a.id) })
      });
      const data = await res.json();
      setDigest(data.digest);
    } catch (error) {
      alert('Digest generation failed: ' + error.message);
    }
    setLoading(false);
  }, [articles]);

  // Wrapper functions for feed operations that need App callbacks
  const handleDeleteFeed = useCallback(async (id) => {
    await deleteFeed(id, selectedFeed, setSelectedFeed, fetchArticles);
  }, [deleteFeed, selectedFeed, fetchArticles]);

  const handleSyncFeed = useCallback(async (id) => {
    await syncFeed(id, fetchArticles);
  }, [syncFeed, fetchArticles]);

  const handleImportFeeds = useCallback(async (opmlContent) => {
    await importFeeds(opmlContent, fetchArticles);
  }, [importFeeds, fetchArticles]);

  return (
    <div className="app">
      <button 
        className="mobile-menu-btn"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        ☰
      </button>
      <FeedList
        feeds={feeds}
        selectedFeed={selectedFeed}
        showSavedOnly={showSavedOnly}
        onSelectFeed={(feedId) => {
          handleSelectFeed(feedId);
          setSidebarOpen(false);
        }}
        onSelectSaved={() => {
          handleSelectSaved();
          setSidebarOpen(false);
        }}
        onCloseSidebar={() => setSidebarOpen(false)}
        onAddFeed={addFeed}
        onDeleteFeed={handleDeleteFeed}
        onSyncFeed={handleSyncFeed}
        onRenameFeed={renameFeed}
        unreadCounts={unreadCounts}
        sidebarOpen={sidebarOpen}
      />
      <div className="main-content">
        <Toolbar
          onSortByAI={sortByAI}
          onToggleUnread={() => setShowUnreadOnly(!showUnreadOnly)}
          showUnreadOnly={showUnreadOnly}
          hasArticles={articles.length > 0}
          onOpenSettings={() => setShowSettings(true)}
          onMarkAllAsRead={markAllAsRead}
          hasUnread={articles.some(a => !a.is_read)}
        />
        {loading ? (
          <div className="ai-loading-banner">
            AI is analyzing articles... Results will appear when ready.
          </div>
        ) : null}
        {syncing ? (
          <div className="sync-indicator">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2V5M8 11V14M14 8H11M5 8H2M12.5 12.5L10.5 10.5M10.5 5.5L12.5 3.5M3.5 12.5L5.5 10.5M5.5 5.5L3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        ) : null}
        <ArticleList articles={articles} onMarkAsRead={markAsRead} onToggleSaved={toggleSaved} categories={categories} />
      </div>
      <Suspense fallback={null}>
        {showSettings && (
          <SettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onExport={exportFeeds}
            onImport={handleImportFeeds}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
