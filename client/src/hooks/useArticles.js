import { useCallback, useEffect, useState } from 'react';
import { APIError } from '../utils/api.js';

/**
 * Custom hook for article fetching with parallel queries
 *
 * Features:
 * - Fetches filtered and all articles in parallel
 * - Client-side filtering for saved articles
 * - Client-side feed filtering
 * - Automatic refetch when filters change
 * - Proper error handling with APIError
 *
 * @param {Object} params - Hook parameters
 * @param {number|null} params.selectedFeed - Selected feed ID or null
 * @param {boolean} params.showUnreadOnly - Show only unread articles
 * @param {boolean} params.showSavedOnly - Show only saved articles
 * @returns {Object} Articles state and fetch function
 */
export function useArticles({ selectedFeed, showUnreadOnly, showSavedOnly }) {
  const [articles, setArticles] = useState([]);
  const [allArticles, setAllArticles] = useState([]);
  const [error, setError] = useState(null);

  const fetchArticles = useCallback(async (shouldThrow = false) => {
    try {
      setError(null);

      const params = new URLSearchParams();
      if (selectedFeed) params.append('feedId', selectedFeed);
      // Don't apply unread filter when showing saved articles
      if (showUnreadOnly && !showSavedOnly) params.append('unreadOnly', 'true');

      // Fetch both filtered and all articles in parallel using the validated API client
      const [data, allData] = await Promise.all([
        fetch(`/api/articles?${params}`).then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new APIError(err.error || 'Failed to fetch articles', res.status);
          }
          return res.json();
        }),
        fetch('/api/articles').then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new APIError(err.error || 'Failed to fetch articles', res.status);
          }
          return res.json();
        })
      ]);

      // Filter for saved articles on client side (always show all saved, read or unread)
      let filteredData = data;
      if (showSavedOnly) {
        filteredData = data.filter(a => a.is_saved);
      }

      // Double-check client-side filtering to ensure no wrong articles slip through
      if (selectedFeed) {
        filteredData = filteredData.filter(a => a.feed_id === selectedFeed);
      }

      setArticles(filteredData);
      setAllArticles(allData);
      return true;
    } catch (error) {
      // Re-throw API errors if shouldThrow is true (for manual calls)
      // For automatic calls (useEffect), just set error state
      console.error('Failed to fetch articles:', error);
      setError(error);
      if (shouldThrow) {
        throw error;
      }
      return false;
    }
  }, [selectedFeed, showUnreadOnly, showSavedOnly]);

  useEffect(() => {
    fetchArticles(false); // Don't throw for automatic fetches
  }, [fetchArticles]);

  return {
    articles,
    allArticles,
    setArticles,
    setAllArticles,
    fetchArticles: () => fetchArticles(true), // Throw for manual calls
    error
  };
}
