import { useState, useCallback } from 'react';
import { APIError } from '../utils/api.js';

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
 * All operations use proper error handling with APIError
 *
 * @returns {Object} Feed operations and state
 */
export function useFeedOperations() {
  const [feeds, setFeeds] = useState([]);
  const [error, setError] = useState(null);

  const fetchFeeds = useCallback(async (shouldThrow = false) => {
    try {
      setError(null);
      const res = await fetch('/api/feeds');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to fetch feeds', res.status);
      }
      const data = await res.json();
      setFeeds(data);
      return true;
    } catch (error) {
      console.error('Failed to fetch feeds:', error);
      setError(error);
      if (shouldThrow) {
        throw error;
      }
      return false;
    }
  }, []);

  const addFeed = useCallback(async (url) => {
    try {
      setError(null);
      const res = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to add feed', res.status);
      }
      await fetchFeeds(false);
      return true;
    } catch (error) {
      console.error('Failed to add feed:', error);
      setError(error);
      throw error;
    }
  }, [fetchFeeds]);

  const deleteFeed = useCallback(async (id, selectedFeed, setSelectedFeed, fetchArticles) => {
    try {
      setError(null);
      const res = await fetch(`/api/feeds/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to delete feed', res.status);
      }
      await fetchFeeds(false);
      // Clear selected feed if it was the deleted one
      if (selectedFeed === id && setSelectedFeed) {
        setSelectedFeed(null);
      }
      if (fetchArticles) {
        await fetchArticles();
      }
      return true;
    } catch (error) {
      console.error('Failed to delete feed:', error);
      setError(error);
      throw error;
    }
  }, [fetchFeeds]);

  const syncFeed = useCallback(async (id, fetchArticles) => {
    try {
      setError(null);
      const res = await fetch(`/api/feeds/${id}/sync`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to sync feed', res.status);
      }
      if (fetchArticles) {
        await fetchArticles();
      }
      return true;
    } catch (error) {
      console.error('Failed to sync feed:', error);
      setError(error);
      throw error;
    }
  }, []);

  const renameFeed = useCallback(async (id, newTitle) => {
    try {
      setError(null);
      // Optimistic update - update UI immediately
      setFeeds(prev => prev.map(f =>
        f.id === id ? { ...f, title: newTitle } : f
      ));

      // Then sync with server
      const res = await fetch(`/api/feeds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to rename feed', res.status);
      }
      return true;
    } catch (error) {
      console.error('Failed to rename feed:', error);
      setError(error);
      // Revert optimistic update on error
      await fetchFeeds(false);
      throw error;
    }
  }, [fetchFeeds]);

  const exportFeeds = useCallback(() => {
    window.open('/api/feeds/export', '_blank');
  }, []);

  const importFeeds = useCallback(async (opmlContent, fetchArticles) => {
    try {
      setError(null);
      const res = await fetch('/api/feeds/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opml: opmlContent })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to import feeds', res.status);
      }
      const result = await res.json();
      alert(`Import complete: ${result.imported} feeds imported, ${result.failed} failed`);
      await fetchFeeds(false);
      if (fetchArticles) {
        await fetchArticles();
      }
      return true;
    } catch (error) {
      console.error('Failed to import feeds:', error);
      setError(error);
      alert('Import failed: ' + error.message);
      throw error;
    }
  }, [fetchFeeds]);

  return {
    feeds,
    setFeeds,
    fetchFeeds: () => fetchFeeds(true),
    addFeed,
    deleteFeed,
    syncFeed,
    renameFeed,
    exportFeeds,
    importFeeds,
    error
  };
}
