import React, { useState, useEffect } from 'react';
import FeedList from './components/FeedList';
import ArticleList from './components/ArticleList';
import Toolbar from './components/Toolbar';
import SettingsModal from './components/SettingsModal';

function App() {
  const [feeds, setFeeds] = useState([]);
  const [articles, setArticles] = useState([]);
  const [allArticles, setAllArticles] = useState([]); // Store all articles for counts
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [categories, setCategories] = useState(null);

  const handleSelectFeed = (feedId) => {
    setSelectedFeed(feedId);
    setShowSavedOnly(false);
  };

  const handleSelectSaved = () => {
    setSelectedFeed(null);
    setShowSavedOnly(true);
  };

  useEffect(() => {
    fetchFeeds();
    syncAllFeeds(); // Sync on app load
    
    // Auto-refresh every 15 minutes
    const interval = setInterval(() => {
      syncAllFeeds();
    }, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Global keyboard shortcuts
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'c' && categories) {
        e.preventDefault();
        setCategories(null);
        // Re-fetch to get chronological order
        fetchArticles();
      } else if (e.key === 'r') {
        e.preventDefault();
        syncAllFeeds();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [categories]);



  useEffect(() => {
    fetchArticles();
    setCategories(null); // Clear categories when filter changes
  }, [selectedFeed, showUnreadOnly, showSavedOnly]);

  const fetchFeeds = async () => {
    const res = await fetch('/api/feeds');
    const data = await res.json();
    setFeeds(data);
  };

  const fetchArticles = async () => {
    const params = new URLSearchParams();
    if (selectedFeed) params.append('feedId', selectedFeed);
    // Don't apply unread filter when showing saved articles
    if (showUnreadOnly && !showSavedOnly) params.append('unreadOnly', 'true');
    
    const res = await fetch(`/api/articles?${params}`);
    let data = await res.json();
    
    // Filter for saved articles on client side (always show all saved, read or unread)
    if (showSavedOnly) {
      data = data.filter(a => a.is_saved);
    }
    
    setArticles(data);
    
    // Also fetch all articles for unread counts
    const allRes = await fetch('/api/articles');
    const allData = await allRes.json();
    setAllArticles(allData);
  };

  const addFeed = async (url) => {
    await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    fetchFeeds();
  };

  const deleteFeed = async (id) => {
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    fetchFeeds();
    if (selectedFeed === id) setSelectedFeed(null);
  };

  const syncFeed = async (id) => {
    await fetch(`/api/feeds/${id}/sync`, { method: 'POST' });
    fetchArticles();
  };

  const renameFeed = async (id, newTitle) => {
    setFeeds(prev => prev.map(f => 
      f.id === id ? { ...f, title: newTitle } : f
    ));
    
    await fetch(`/api/feeds/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });
  };

  const syncAllFeeds = async () => {
    try {
      await fetch('/api/feeds/sync-all', { method: 'POST' });
      fetchArticles();
    } catch (error) {
      console.error('Failed to sync feeds:', error);
    }
  };

  const exportFeeds = async () => {
    window.open('/api/feeds/export', '_blank');
  };

  const importFeeds = async (opmlContent) => {
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
  };

  const markAsRead = async (id, isRead) => {
    // Update server
    await fetch(`/api/articles/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead })
    });
    
    // Update locally after server confirms
    setArticles(prev => prev.map(a => 
      a.id === id ? { ...a, is_read: isRead } : a
    ));
    setAllArticles(prev => prev.map(a => 
      a.id === id ? { ...a, is_read: isRead } : a
    ));
  };

  const toggleSaved = async (id, isSaved) => {
    // Update server
    await fetch(`/api/articles/${id}/saved`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSaved })
    });
    
    // Update locally after server confirms
    setArticles(prev => prev.map(a => 
      a.id === id ? { ...a, is_saved: isSaved } : a
    ));
    setAllArticles(prev => prev.map(a => 
      a.id === id ? { ...a, is_saved: isSaved } : a
    ));
  };

  const markAllAsRead = async () => {
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
  };

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

  const sortByAI = async () => {
    const MAX_ARTICLES = 50;
    
    if (articles.length > MAX_ARTICLES) {
      const proceed = confirm(
        `You have ${articles.length} articles. AI sorting works best with fewer articles.\n\n` +
        `Sort only the first ${MAX_ARTICLES} articles (most recent)?`
      );
      if (!proceed) return;
    }
    
    // Show loading indicator
    setLoading(true);
    
    // Immediately show articles in current order so users can start reading
    // (articles are already displayed, so nothing to do here)
    
    // Start AI sorting in background
    try {
      const articlesToSort = articles.slice(0, MAX_ARTICLES);
      const remainingArticles = articles.slice(MAX_ARTICLES);
      
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
  };

  const generateDigest = async () => {
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
  };

  return (
    <div className="app">
      <FeedList
        feeds={feeds}
        selectedFeed={selectedFeed}
        showSavedOnly={showSavedOnly}
        onSelectFeed={handleSelectFeed}
        onSelectSaved={handleSelectSaved}
        onAddFeed={addFeed}
        onDeleteFeed={deleteFeed}
        onSyncFeed={syncFeed}
        onRenameFeed={renameFeed}
        unreadCounts={unreadCounts}
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
        {loading && (
          <div className="ai-loading-banner">
            AI is analyzing articles... Results will appear when ready.
          </div>
        )}
        <ArticleList articles={articles} onMarkAsRead={markAsRead} onToggleSaved={toggleSaved} categories={categories} />
      </div>
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        onExport={exportFeeds}
        onImport={importFeeds}
      />
    </div>
  );
}

export default App;
