import { useCallback, useEffect, useState } from 'react';

/**
 * Custom hook for article fetching with parallel queries
 *
 * Features:
 * - Fetches filtered and all articles in parallel
 * - Client-side filtering for saved articles
 * - Client-side feed filtering
 * - Automatic refetch when filters change
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
    fetchArticles();
  }, [fetchArticles]);

  return {
    articles,
    allArticles,
    setArticles,
    setAllArticles,
    fetchArticles
  };
}
