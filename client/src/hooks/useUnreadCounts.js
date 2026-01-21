import { useMemo } from 'react';

/**
 * Custom hook for calculating unread article counts per feed
 *
 * Calculates both total unread count and per-feed unread counts
 * for display in the feed list sidebar.
 *
 * @param {Array} allArticles - All articles array
 * @returns {Object} Unread counts with total and per-feed breakdown
 */
export function useUnreadCounts(allArticles) {
  return useMemo(() => {
    const counts = { total: 0 };
    allArticles.forEach(article => {
      if (!article.is_read) {
        counts.total++;
        counts[article.feed_id] = (counts[article.feed_id] || 0) + 1;
      }
    });
    return counts;
  }, [allArticles]);
}
