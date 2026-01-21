import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import FeedList from './components/FeedList';
import ArticleList from './components/ArticleList';
import Toolbar from './components/Toolbar';
const SettingsModal = lazy(() => import('./components/SettingsModal'));

function App() {
  const [feeds, setFeeds] = useState([]);
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

  const fetchFeeds = async () => {
    const res = await fetch('/api/feeds');
    const data = await res.json();
    setFeeds(data);
  };

  const addFeed = useCallback(async (url) => {
    await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    fetchFeeds();
  }, []);

  const deleteFeed = useCallback(async (id) => {
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    fetchFeeds();
    if (selectedFeed === id) setSelectedFeed(null);
  }, [selectedFeed]);

  const syncFeed = useCallback(async (id) => {
    await fetch(`/api/feeds/${id}/sync`, { method: 'POST' });
    fetchArticles();
  }, []);

  const renameFeed = useCallback(async (id, newTitle) => {
    setFeeds(prev => prev.map(f => 
      f.id === id ? { ...f, title: newTitle } : f
    ));
    
    await fetch(`/api/feeds/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });
  }, []);

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
        fetchArticles();
      }

    } catch (error) {
      console.error('Failed to sync feeds:', error);
    } finally {
      setSyncing(false);
    }
  }, [fetchArticles]);

  const exportFeeds = useCallback(async () => {
    window.open('/api/feeds/export', '_blank');
  }, []);

  const importFeeds = useCallback(async (opmlContent) => {
    try {
      const res = await fetch('/api/feeds/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opml: opmlContent })
      });
      const result = await res.json();
      alert(`Import complete: ${result.imported} feeds imported, ${result.failed} failed`);
      fetchFeeds();
      fetchArticles();
    } catch (error) {
      alert('Import failed: ' + error.message);
    }
  }, []);

  const markAsRead = useCallback(async (id, isRead) => {
    // Update server
    await fetch(`/api/articles/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead })
    });
    
    // Update locally - keep article in current view even if it no longer matches filter
    // This prevents jarring disappearances while navigating
    setArticles(prev => prev.map(a => 
      a.id === id ? { ...a, is_read: isRead } : a
    ));
    setAllArticles(prev => prev.map(a =>
      a.id === id ? { ...a, is_read: isRead } : a
    ));
  }, []);

  const toggleSaved = useCallback(async (id, isSaved) => {
    // Update server
    await fetch(`/api/articles/${id}/saved`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSaved })
    });
    
    // Update locally - keep article in current view
    setArticles(prev => prev.map(a => 
      a.id === id ? { ...a, is_saved: isSaved } : a
    ));
    setAllArticles(prev => prev.map(a =>
      a.id === id ? { ...a, is_saved: isSaved } : a
    ));
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = articles.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;
    
    // Update locally first
    setArticles(prev => prev.map(a => ({ ...a, is_read: true })));
    setAllArticles(prev => prev.map(a => 
      unreadIds.includes(a.id) ? { ...a, is_read: true } : a
    ));
    
    // Update server
    await Promise.all(unreadIds.map(id => 
      fetch(`/api/articles/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true })
      })
    ));
  }, [articles]);

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
        onDeleteFeed={deleteFeed}
        onSyncFeed={syncFeed}
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
            onImport={importFeeds}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
