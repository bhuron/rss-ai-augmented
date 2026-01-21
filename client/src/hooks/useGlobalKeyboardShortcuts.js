import { useEffect } from 'react';
import { useEventListener } from './useEventListener.js';

/**
 * Custom hook for global keyboard shortcuts
 *
 * Shortcuts:
 * - c: Clear AI sorting and restore chronological order
 * - r: Sync all feeds (user-initiated)
 * - a: Select all feeds
 * - l: Select saved articles
 *
 * @param {Object} params - Hook parameters
 * @param {Object|null} params.categories - Current AI categories
 * @param {Function} params.setCategories - Set categories state
 * @param {Function} params.syncAllFeeds - Sync all feeds function
 * @param {Function} params.fetchArticles - Fetch articles function
 * @param {Function} params.handleSelectFeed - Handle feed selection
 * @param {Function} params.handleSelectSaved - Handle saved selection
 */
export function useGlobalKeyboardShortcuts({
  categories,
  setCategories,
  syncAllFeeds,
  fetchArticles,
  handleSelectFeed,
  handleSelectSaved
}) {
  useEventListener('keydown', async (e) => {
    // Don't trigger shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'c' && categories) {
      e.preventDefault();
      setCategories(null);
      // Re-fetch to restore chronological order
      await fetchArticles();
    } else if (e.key === 'r') {
      e.preventDefault();
      await syncAllFeeds(true);
    } else if (e.key === 'a') {
      e.preventDefault();
      handleSelectFeed(null);
    } else if (e.key === 'l') {
      e.preventDefault();
      handleSelectSaved();
    }
  });
}
