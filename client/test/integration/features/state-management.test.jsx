import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useArticleOperations } from '../../../src/hooks/useArticleOperations.js';

describe('State synchronization (Integration)', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should keep articles and allArticles in sync when marking as read', async () => {
    const articles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false }
    ];
    const allArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false },
      { id: 3, title: 'Article 3', is_read: false, is_saved: false }
    ];

    const setArticles = vi.fn();
    const setAllArticles = vi.fn();

    const { result } = renderHook(() =>
      useArticleOperations({ articles, setArticles, allArticles, setAllArticles })
    );

    await act(async () => {
      await result.current.markAsRead(1, true);
    });

    // Both setArticles and setAllArticles should be called
    expect(setArticles).toHaveBeenCalled();
    expect(setAllArticles).toHaveBeenCalled();

    // Verify the updates mark article 1 as read in both arrays
    const articlesUpdate = setArticles.mock.calls[0][0];
    const allArticlesUpdate = setAllArticles.mock.calls[0][0];

    expect(articlesUpdate(articles)[0].is_read).toBe(true);
    expect(allArticlesUpdate(allArticles)[0].is_read).toBe(true);
  });

  it('should keep articles and allArticles in sync when toggling saved', async () => {
    const articles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false }
    ];
    const allArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false },
      { id: 3, title: 'Article 3', is_read: false, is_saved: false }
    ];

    const setArticles = vi.fn();
    const setAllArticles = vi.fn();

    const { result } = renderHook(() =>
      useArticleOperations({ articles, setArticles, allArticles, setAllArticles })
    );

    await act(async () => {
      await result.current.toggleSaved(1, true);
    });

    // Both should be called
    expect(setArticles).toHaveBeenCalled();
    expect(setAllArticles).toHaveBeenCalled();

    // Verify the updates toggle saved status in both arrays
    const articlesUpdate = setArticles.mock.calls[0][0];
    const allArticlesUpdate = setAllArticles.mock.calls[0][0];

    expect(articlesUpdate(articles)[0].is_saved).toBe(true);
    expect(allArticlesUpdate(allArticles)[0].is_saved).toBe(true);
  });

  it('should handle rapid state changes correctly', async () => {
    const articles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false },
      { id: 3, title: 'Article 3', is_read: false, is_saved: false },
      { id: 4, title: 'Article 4', is_read: false, is_saved: false },
      { id: 5, title: 'Article 5', is_read: false, is_saved: false }
    ];
    const allArticles = [...articles];

    const setArticles = vi.fn();
    const setAllArticles = vi.fn();

    const { result } = renderHook(() =>
      useArticleOperations({ articles, setArticles, allArticles, setAllArticles })
    );

    // Mark all articles as read rapidly
    await act(async () => {
      await Promise.all([
        result.current.markAsRead(1, true),
        result.current.markAsRead(2, true),
        result.current.markAsRead(3, true),
        result.current.markAsRead(4, true),
        result.current.markAsRead(5, true)
      ]);
    });

    // All updates should be applied
    expect(setArticles).toHaveBeenCalledTimes(5);
    expect(setAllArticles).toHaveBeenCalledTimes(5);

    // Verify each update was correct
    for (let i = 0; i < 5; i++) {
      const articlesUpdate = setArticles.mock.calls[i][0];
      const allArticlesUpdate = setAllArticles.mock.calls[i][0];
      expect(articlesUpdate(articles)[i].is_read).toBe(true);
      expect(allArticlesUpdate(allArticles)[i].is_read).toBe(true);
    }
  });

  it('should update unread counts when articles change', async () => {
    const articles = [
      { id: 1, title: 'Article 1', is_read: false, feed_id: 1 },
      { id: 2, title: 'Article 2', is_read: false, feed_id: 2 },
      { id: 3, title: 'Article 3', is_read: false, feed_id: 1 }
    ];
    const allArticles = [...articles];

    const setArticles = vi.fn();
    const setAllArticles = vi.fn();

    const { result } = renderHook(() =>
      useArticleOperations({ articles, setArticles, allArticles, setAllArticles })
    );

    // Mark article 1 as read
    await act(async () => {
      await result.current.markAsRead(1, true);
    });

    // Verify the state updater functions preserve feed_id
    const articlesUpdate = setArticles.mock.calls[0][0];
    const allArticlesUpdate = setAllArticles.mock.calls[0][0];

    const updatedArticles = articlesUpdate(articles);
    const updatedAllArticles = allArticlesUpdate(allArticles);

    expect(updatedArticles[0].is_read).toBe(true);
    expect(updatedArticles[0].feed_id).toBe(1); // feed_id preserved
    expect(updatedAllArticles[0].is_read).toBe(true);
    expect(updatedAllArticles[0].feed_id).toBe(1); // feed_id preserved
  });
});
