import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArticles } from '../../../src/hooks/useArticles.js';

// Mock fetch
global.fetch = vi.fn();

describe('useArticles', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  it('should fetch articles on mount', async () => {
    const mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false, feed_id: 1 },
      { id: 2, title: 'Article 2', is_read: true, is_saved: false, feed_id: 1 }
    ];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      });

    const { result } = renderHook(() =>
      useArticles({
        selectedFeed: null,
        showUnreadOnly: false,
        showSavedOnly: false
      })
    );

    // Wait for async operations to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.articles).toEqual(mockArticles);
    expect(result.current.allArticles).toEqual(mockArticles);
  });

  it('should fetch filtered and all articles in parallel', async () => {
    const mockFilteredArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false, feed_id: 1 }
    ];
    const mockAllArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false, feed_id: 1 },
      { id: 2, title: 'Article 2', is_read: true, is_saved: false, feed_id: 1 }
    ];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFilteredArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAllArticles
      });

    const { result } = renderHook(() =>
      useArticles({
        selectedFeed: null,
        showUnreadOnly: true,
        showSavedOnly: false
      })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.articles).toEqual(mockFilteredArticles);
    expect(result.current.allArticles).toEqual(mockAllArticles);

    // Verify both fetches were called (they should be in parallel)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should filter for saved articles on client side', async () => {
    const mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: true, feed_id: 1 },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false, feed_id: 1 }
    ];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      });

    const { result } = renderHook(() =>
      useArticles({
        selectedFeed: null,
        showUnreadOnly: false,
        showSavedOnly: true
      })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.articles).toHaveLength(1);
    expect(result.current.articles[0].is_saved).toBe(true);
  });

  it('should filter by feed on client side', async () => {
    const mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, feed_id: 1 },
      { id: 2, title: 'Article 2', is_read: false, feed_id: 2 }
    ];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      });

    const { result } = renderHook(() =>
      useArticles({
        selectedFeed: 1,
        showUnreadOnly: false,
        showSavedOnly: false
      })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.articles).toHaveLength(1);
    expect(result.current.articles[0].feed_id).toBe(1);
  });

  it('should handle fetch errors gracefully', async () => {
    // Mock both parallel fetch calls to reject
    global.fetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useArticles({
        selectedFeed: null,
        showUnreadOnly: false,
        showSavedOnly: false
      })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch articles:',
      expect.any(Error)
    );
    expect(result.current.error).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });

  it('should provide setArticles and setAllArticles', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

    const { result } = renderHook(() =>
      useArticles({
        selectedFeed: null,
        showUnreadOnly: false,
        showSavedOnly: false
      })
    );

    expect(result.current.setArticles).toBeInstanceOf(Function);
    expect(result.current.setAllArticles).toBeInstanceOf(Function);
  });

  it('should not apply unread filter when showing saved articles', async () => {
    const mockArticles = [
      { id: 1, title: 'Article 1', is_read: true, is_saved: true, feed_id: 1 },
      { id: 2, title: 'Article 2', is_read: true, is_saved: false, feed_id: 1 }
    ];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockArticles
      });

    const { result } = renderHook(() =>
      useArticles({
        selectedFeed: null,
        showUnreadOnly: true,
        showSavedOnly: true
      })
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Should show saved articles even if read (because showSavedOnly takes precedence)
    expect(result.current.articles).toHaveLength(1);
    expect(result.current.articles[0].is_saved).toBe(true);
  });

  it('should refetch when filters change', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => []
    });

    const { result, rerender } = renderHook(
      ({ showUnreadOnly }) => useArticles({
        selectedFeed: null,
        showUnreadOnly,
        showSavedOnly: false
      }),
      { initialProps: { showUnreadOnly: false } }
    );

    // Initial fetch
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(global.fetch).toHaveBeenCalledTimes(2); // 2 parallel fetches

    const previousCallCount = global.fetch.mock.calls.length;

    // Change filter
    await act(async () => {
      rerender({ showUnreadOnly: true });
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(global.fetch).toHaveBeenCalledTimes(previousCallCount + 2);
  });
});
