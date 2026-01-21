import { useCallback, useState } from 'react';

/**
 * Custom hook for feed synchronization with SSE streaming
 *
 * Features:
 * - Server-Sent Events (SSE) streaming for progress updates
 * - Progressive updates as feeds complete syncing
 * - Final refresh of all articles after sync completes
 * - User-initiated syncs refresh both allArticles and visible articles
 *
 * @param {Object} params - Hook parameters
 * @param {Function} params.fetchArticles - Function to fetch visible articles
 * @param {Function} params.setAllArticles - Function to set all articles state
 * @returns {Object} Sync state and functions
 */
export function useFeedSync({ fetchArticles, setAllArticles }) {
  const [syncing, setSyncing] = useState(false);

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
  }, [fetchArticles, setAllArticles]);

  return {
    syncing,
    syncAllFeeds
  };
}
