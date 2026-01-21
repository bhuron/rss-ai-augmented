import { useCallback, useState } from 'react';
import { APIError } from '../utils/api.js';

/**
 * Custom hook for AI-powered article sorting with smart batching
 *
 * Features:
 * - Smart batching: max 100 articles total, max 10 per feed
 * - Prevents high-volume feeds from dominating the sort
 * - Preserves unsorted articles in the results
 * - Error handling with user feedback
 * - Proper error handling with APIError
 *
 * @param {Object} params - Hook parameters
 * @param {Array} params.articles - Current articles array
 * @param {Function} params.setArticles - Set articles state
 * @param {Function} params.setCategories - Set categories state
 * @returns {Object} AI sorting state and functions
 */
export function useAISorting({ articles, setArticles, setCategories }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sortByAI = useCallback(async () => {
    const MAX_ARTICLES = 100;
    const MAX_PER_FEED = 10;

    // Balance articles across feeds to prevent high-volume feeds from dominating
    const articlesByFeed = new Map();
    articles.forEach(article => {
      if (!articlesByFeed.has(article.feed_id)) {
        articlesByFeed.set(article.feed_id, []);
      }
      articlesByFeed.get(article.feed_id).push(article);
    });

    // Take max 10 articles per feed, then fill up to 100 total
    let articlesToSort = [];
    articlesByFeed.forEach(feedArticles => {
      articlesToSort.push(...feedArticles.slice(0, MAX_PER_FEED));
    });

    // Track which articles were initially selected (before adding more)
    const initialSortedIds = new Set(articlesToSort.map(a => a.id));

    // If we have room, add more articles from feeds that had more
    if (articlesToSort.length < MAX_ARTICLES) {
      const remaining = articles.filter(a => !initialSortedIds.has(a.id));
      articlesToSort.push(...remaining.slice(0, MAX_ARTICLES - articlesToSort.length));
    } else {
      articlesToSort = articlesToSort.slice(0, MAX_ARTICLES);
    }

    // Calculate remaining articles (those not in the final articlesToSort)
    const finalSortedIds = new Set(articlesToSort.map(a => a.id));
    const remainingArticles = articles.filter(a => !finalSortedIds.has(a.id));

    if (articlesToSort.length === 0) return;

    // Show loading indicator
    setLoading(true);
    setError(null);

    // Start AI sorting in background
    try {
      const res = await fetch('/api/ai/sort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleIds: articlesToSort.map(a => a.id),
          criteria: 'relevance and importance'
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new APIError(err.error || 'Failed to sort articles', res.status);
      }

      const result = await res.json();

      if (!result.articles || !Array.isArray(result.articles)) {
        throw new APIError('Invalid response from server', 500);
      }

      // Validate categories before setting
      if (result.categories && !Array.isArray(result.categories)) {
        console.warn('Invalid categories format from server, ignoring');
        result.categories = null;
      }

      // Update with AI-sorted results when ready
      const allArticles = [...result.articles, ...remainingArticles];

      setArticles(allArticles);
      setCategories(result.categories || null);
    } catch (error) {
      console.error('AI sorting error:', error);
      setError(error);
      alert('AI sorting failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [articles, setArticles, setCategories]);

  return {
    loading,
    sortByAI,
    error
  };
}
