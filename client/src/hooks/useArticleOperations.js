import { useCallback } from 'react';

/**
 * Custom hook for article state operations
 *
 * Provides:
 * - Mark article as read/unread
 * - Toggle saved status
 * - Mark all articles as read
 *
 * All operations update both articles and allArticles state
 * to maintain consistency between filtered and complete lists.
 *
 * @param {Object} params - Hook parameters
 * @param {Function} params.setArticles - Set articles state
 * @param {Function} params.setAllArticles - Set all articles state
 * @param {Array} params.articles - Current articles array
 * @returns {Object} Article operation functions
 */
export function useArticleOperations({ setArticles, setAllArticles, articles }) {
  const markAsRead = useCallback(async (id, isRead) => {
    // Update server
    await fetch(`/api/articles/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead })
    });

    // Update locally - keep article in current view even if it no longer matches filter
    // This prevents jarring disappearances while navigating
    setArticles(prev => prev.map(a =>
      a.id === id ? { ...a, is_read: isRead } : a
    ));
    setAllArticles(prev => prev.map(a =>
      a.id === id ? { ...a, is_read: isRead } : a
    ));
  }, [setArticles, setAllArticles]);

  const toggleSaved = useCallback(async (id, isSaved) => {
    // Update server
    await fetch(`/api/articles/${id}/saved`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSaved })
    });

    // Update locally - keep article in current view
    setArticles(prev => prev.map(a =>
      a.id === id ? { ...a, is_saved: isSaved } : a
    ));
    setAllArticles(prev => prev.map(a =>
      a.id === id ? { ...a, is_saved: isSaved } : a
    ));
  }, [setArticles, setAllArticles]);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = articles.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;

    // Update locally first for instant feedback
    setArticles(prev => prev.map(a => ({ ...a, is_read: true })));
    setAllArticles(prev => prev.map(a =>
      unreadIds.includes(a.id) ? { ...a, is_read: true } : a
    ));

    // Update server in parallel
    await Promise.all(unreadIds.map(id =>
      fetch(`/api/articles/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true })
      })
    ));
  }, [articles, setArticles, setAllArticles]);

  return {
    markAsRead,
    toggleSaved,
    markAllAsRead
  };
}
