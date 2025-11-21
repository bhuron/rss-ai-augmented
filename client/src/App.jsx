import React, { useState, useEffect } from 'react';
import FeedList from './components/FeedList';
import ArticleList from './components/ArticleList';
import Toolbar from './components/Toolbar';
import SettingsModal from './components/SettingsModal';

function App() {
  const [feeds, setFeeds] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [categories, setCategories] = useState(null);

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
    fetchArticles();
    setCategories(null); // Clear categories when filter changes
  }, [selectedFeed, showUnreadOnly]);

  const fetchFeeds = async () => {
    const res = await fetch('/api/feeds');
    const data = await res.json();
    setFeeds(data);
  };

  const fetchArticles = async () => {
    const params = new URLSearchParams();
    if (selectedFeed) params.append('feedId', selectedFeed);
    if (showUnreadOnly) params.append('unreadOnly', 'true');
    
    const res = await fetch(`/api/articles?${params}`);
    const data = await res.json();
    setArticles(data);
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
    // Update locally first for instant feedback
    setArticles(prev => prev.map(a => 
      a.id === id ? { ...a, is_read: isRead } : a
    ));
    
    // Then update server
    await fetch(`/api/articles/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead })
    });
  };

  const sortByAI = async () => {
    const MAX_ARTICLES = 50;
    
    if (articles.length > MAX_ARTICLES) {
      const proceed = confirm(
        `You have ${articles.length} articles. AI sorting works best with fewer articles.\n\n` +
        `Sort only the first ${MAX_ARTICLES} articles (most recent)?`
      );
      if (!proceed) return;
    }
    
    setLoading(true);
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
      
      // Append remaining articles at the end
      const allArticles = [...result.articles, ...remainingArticles];
      
      setArticles(allArticles);
      setCategories(result.categories);
    } catch (error) {
      console.error('AI sorting error:', error);
      alert('AI sorting failed: ' + error.message);
    }
    setLoading(false);
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
        onSelectFeed={setSelectedFeed}
        onAddFeed={addFeed}
        onDeleteFeed={deleteFeed}
        onSyncFeed={syncFeed}
      />
      <div className="main-content">
        <Toolbar
          onSortByAI={sortByAI}
          onToggleUnread={() => setShowUnreadOnly(!showUnreadOnly)}
          showUnreadOnly={showUnreadOnly}
          hasArticles={articles.length > 0}
          onOpenSettings={() => setShowSettings(true)}
        />
        {loading && <div className="loading">Processing with AI...</div>}
        <ArticleList articles={articles} onMarkAsRead={markAsRead} categories={categories} />
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
