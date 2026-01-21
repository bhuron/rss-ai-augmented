import { useState, useCallback } from 'react';

/**
 * Custom hook for feed CRUD operations
 *
 * Provides:
 * - Feed state management
 * - Fetch all feeds
 * - Add new feed
 * - Delete feed
 * - Sync single feed
 * - Rename feed
 * - Export feeds to OPML
 * - Import feeds from OPML
 *
 * @returns {Object} Feed operations and state
 */
export function useFeedOperations() {
  const [feeds, setFeeds] = useState([]);

  const fetchFeeds = useCallback(async () => {
    const res = await fetch('/api/feeds');
    const data = await res.json();
    setFeeds(data);
  }, []);

  const addFeed = useCallback(async (url) => {
    await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    await fetchFeeds();
  }, [fetchFeeds]);

  const deleteFeed = useCallback(async (id, selectedFeed, setSelectedFeed, fetchArticles) => {
    await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
    await fetchFeeds();
    // Clear selected feed if it was the deleted one
    if (selectedFeed === id && setSelectedFeed) {
      setSelectedFeed(null);
    }
    if (fetchArticles) {
      await fetchArticles();
    }
  }, [fetchFeeds]);

  const syncFeed = useCallback(async (id, fetchArticles) => {
    await fetch(`/api/feeds/${id}/sync`, { method: 'POST' });
    if (fetchArticles) {
      await fetchArticles();
    }
  }, []);

  const renameFeed = useCallback(async (id, newTitle) => {
    // Optimistic update - update UI immediately
    setFeeds(prev => prev.map(f =>
      f.id === id ? { ...f, title: newTitle } : f
    ));

    // Then sync with server
    await fetch(`/api/feeds/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });
  }, []);

  const exportFeeds = useCallback(() => {
    window.open('/api/feeds/export', '_blank');
  }, []);

  const importFeeds = useCallback(async (opmlContent, fetchArticles) => {
    try {
      const res = await fetch('/api/feeds/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opml: opmlContent })
      });
      const result = await res.json();
      alert(`Import complete: ${result.imported} feeds imported, ${result.failed} failed`);
      await fetchFeeds();
      if (fetchArticles) {
        await fetchArticles();
      }
    } catch (error) {
      alert('Import failed: ' + error.message);
    }
  }, [fetchFeeds]);

  return {
    feeds,
    setFeeds,
    fetchFeeds,
    addFeed,
    deleteFeed,
    syncFeed,
    renameFeed,
    exportFeeds,
    importFeeds
  };
}
