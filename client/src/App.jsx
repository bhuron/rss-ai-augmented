import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { useFeedOperations } from './hooks/useFeedOperations.js';
import { useArticleOperations } from './hooks/useArticleOperations.js';
import { useArticles } from './hooks/useArticles.js';
import { useFeedSync } from './hooks/useFeedSync.js';
import { useAISorting } from './hooks/useAISorting.js';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts.js';
import { useUnreadCounts } from './hooks/useUnreadCounts.js';
import FeedList from './components/FeedList';
import ArticleList from './components/ArticleList';
import Toolbar from './components/Toolbar';
const SettingsModal = lazy(() => import('./components/SettingsModal'));

function App() {
  // Feed operations hook
  const { feeds, fetchFeeds, addFeed, deleteFeed, syncFeed, renameFeed, exportFeeds, importFeeds } = useFeedOperations();

  const [selectedFeed, setSelectedFeed] = useState(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [categories, setCategories] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Articles hook
  const { articles, allArticles, setArticles, setAllArticles, fetchArticles } = useArticles({
    selectedFeed,
    showUnreadOnly,
    showSavedOnly
  });

  // Feed sync hook
  const { syncing, syncAllFeeds } = useFeedSync({
    fetchArticles,
    setAllArticles
  });

  // AI sorting hook
  const { loading: aiLoading, sortByAI } = useAISorting({
    articles,
    setArticles,
    setCategories
  });

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

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    categories,
    setCategories,
    syncAllFeeds,
    fetchArticles,
    handleSelectFeed,
    handleSelectSaved
  });

  // Calculate unread counts per feed
  const unreadCounts = useUnreadCounts(allArticles);

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
        {aiLoading ? (
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
