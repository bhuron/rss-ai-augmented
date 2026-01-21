import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useArticles } from '../../../src/hooks/useArticles.js';

describe('Article fetching (Integration)', () => {
  let fetchSpy;

  const mockArticles = [
    { id: 1, title: 'Article 1', is_read: false, is_saved: true, feed_id: 1 },
    { id: 2, title: 'Article 2', is_read: true, is_saved: false, feed_id: 1 },
    { id: 3, title: 'Article 3', is_read: false, is_saved: false, feed_id: 2 },
    { id: 4, title: 'Article 4', is_read: true, is_saved: true, feed_id: 2 },
    { id: 5, title: 'Article 5', is_read: false, is_saved: false, feed_id: 3 }
  ];

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should fetch filtered and all articles in parallel', async () => {
    fetchSpy.mockImplementation((url) => {
      // Both calls should be made
      if (url === '/api/articles?unreadOnly=true') {
        return Promise.resolve({
          ok: true,
          json: async () => mockArticles.filter(a => !a.is_read)
        });
      } else if (url === '/api/articles') {
        return Promise.resolve({
          ok: true,
          json: async () => mockArticles
        });
      }
    });

    const { result } = renderHook(() =>
      useArticles({ selectedFeed: null, showUnreadOnly: true, showSavedOnly: false })
    );

    // Both fetch calls should be made immediately (in parallel)
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledWith('/api/articles?unreadOnly=true');
    expect(fetchSpy).toHaveBeenCalledWith('/api/articles');

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.articles.length).toBeGreaterThan(0);
    expect(result.current.allArticles.length).toBeGreaterThan(0);
  });

  it('should update both articles and allArticles state correctly', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles.filter(a => !a.is_read)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      });

    const { result } = renderHook(() =>
      useArticles({ selectedFeed: null, showUnreadOnly: true, showSavedOnly: false })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // articles should have filtered results
    expect(result.current.articles).toEqual(mockArticles.filter(a => !a.is_read));

    // allArticles should have all articles
    expect(result.current.allArticles).toEqual(mockArticles);
  });

  it('should apply unread filter correctly', async () => {
    const unreadArticles = mockArticles.filter(a => !a.is_read);

    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => unreadArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      });

    const { result } = renderHook(() =>
      useArticles({ selectedFeed: null, showUnreadOnly: true, showSavedOnly: false })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Should only have unread articles
    expect(result.current.articles.every(a => !a.is_read)).toBe(true);
    expect(result.current.articles.length).toBe(3); // 3 unread articles
  });

  it('should apply saved filter correctly (client-side)', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      });

    const { result } = renderHook(() =>
      useArticles({ selectedFeed: null, showUnreadOnly: false, showSavedOnly: true })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Should only have saved articles (client-side filter)
    expect(result.current.articles.every(a => a.is_saved)).toBe(true);
    expect(result.current.articles.length).toBe(2); // 2 saved articles
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock both parallel fetch calls to reject
    fetchSpy
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useArticles({ selectedFeed: null, showUnreadOnly: false, showSavedOnly: false })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Error state should be set
    expect(result.current.error).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });
});
