import { useCallback, useState } from 'react';
import { APIError } from '../utils/api.js';

/**
 * Custom hook for feed synchronization with SSE streaming
 *
 * Features:
 * - Server-Sent Events (SSE) streaming for progress updates
 * - Progressive updates as feeds complete syncing
 * - Final refresh of all articles after sync completes
 * - User-initiated syncs refresh both allArticles and visible articles
 * - Proper error handling with APIError
 *
 * @param {Object} params - Hook parameters
 * @param {Function} params.fetchArticles - Function to fetch visible articles
 * @param {Function} params.setAllArticles - Function to set all articles state
 * @returns {Object} Sync state and functions
 */
export function useFeedSync({ fetchArticles, setAllArticles }) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const syncAllFeeds = useCallback(async (userInitiated = false) => {
    setSyncing(true);
    setError(null);
    try {
      const response = await fetch('/api/feeds/sync-all', { method: 'POST' });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to sync feeds', response.status);
      }

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
              if (!allRes.ok) {
                const err = await allRes.json().catch(() => ({}));
                throw new APIError(err.error || 'Failed to fetch articles', allRes.status);
              }
              const allData = await allRes.json();
              setAllArticles(allData);
            }
          } catch (e) {
            // Ignore parse errors for SSE stream
          }
        }
      }

      // Final update - refresh all articles for sidebar counts
      const allRes = await fetch('/api/articles');
      if (!allRes.ok) {
        const err = await allRes.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to fetch articles', allRes.status);
      }
      const allData = await allRes.json();
      setAllArticles(allData);

      // If user-initiated (pressed 'r'), also refresh the visible article list
      if (userInitiated) {
        await fetchArticles();
      }

      return true;
    } catch (error) {
      console.error('Failed to sync feeds:', error);
      setError(error);
      // Only throw if user-initiated sync (automatic syncs shouldn't crash the app)
      if (userInitiated) {
        throw error;
      }
      return false;
    } finally {
      setSyncing(false);
    }
  }, [fetchArticles, setAllArticles]);

  return {
    syncing,
    syncAllFeeds,
    error
  };
}
