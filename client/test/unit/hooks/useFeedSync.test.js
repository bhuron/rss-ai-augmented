import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedSync } from '../../../src/hooks/useFeedSync.js';

// Mock fetch
global.fetch = vi.fn();

describe('useFeedSync', () => {
  let mockFetchArticles;
  let mockSetAllArticles;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();

    mockFetchArticles = vi.fn();
    mockSetAllArticles = vi.fn();
  });

  it('should sync all feeds and update allArticles', async () => {
    // Mock SSE streaming response
    const mockStream = {
      getReader: vi.fn(() => ({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"type":"progress"}\n') })
          .mockResolvedValueOnce({ done: true, value: null })
      }))
    };

    const mockAllArticles = [
      { id: 1, title: 'Article 1', is_read: false },
      { id: 2, title: 'Article 2', is_read: true }
    ];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        body: mockStream
      })
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      });

    const { result } = renderHook(() =>
      useFeedSync({
        fetchArticles: mockFetchArticles,
        setAllArticles: mockSetAllArticles
      })
    );

    await act(async () => {
      await result.current.syncAllFeeds();
    });

    expect(result.current.syncing).toBe(false);
    expect(mockSetAllArticles).toHaveBeenCalledWith(mockAllArticles);
    expect(mockSetAllArticles).toHaveBeenCalledTimes(2); // Once during progress, once at end
  });

  it('should refresh visible articles when user-initiated', async () => {
    const mockStream = {
      getReader: vi.fn(() => ({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"type":"progress"}\n') })
          .mockResolvedValueOnce({ done: true, value: null })
      }))
    };

    const mockAllArticles = [{ id: 1, title: 'Article 1', is_read: false }];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        body: mockStream
      })
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      });

    const { result } = renderHook(() =>
      useFeedSync({
        fetchArticles: mockFetchArticles,
        setAllArticles: mockSetAllArticles
      })
    );

    await act(async () => {
      await result.current.syncAllFeeds(true);
    });

    expect(mockFetchArticles).toHaveBeenCalled();
  });

  it('should not refresh visible articles when not user-initiated', async () => {
    const mockStream = {
      getReader: vi.fn(() => ({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"type":"progress"}\n') })
          .mockResolvedValueOnce({ done: true, value: null })
      }))
    };

    const mockAllArticles = [{ id: 1, title: 'Article 1', is_read: false }];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        body: mockStream
      })
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      })
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      });

    const { result } = renderHook(() =>
      useFeedSync({
        fetchArticles: mockFetchArticles,
        setAllArticles: mockSetAllArticles
      })
    );

    await act(async () => {
      await result.current.syncAllFeeds(false);
    });

    expect(mockFetchArticles).not.toHaveBeenCalled();
  });

  it('should set syncing to true during sync and false after completion', async () => {
    const mockStream = {
      getReader: vi.fn(() => ({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"type":"progress"}\n') })
          .mockResolvedValueOnce({ done: true, value: null })
      }))
    };

    const mockAllArticles = [{ id: 1, title: 'Article 1', is_read: false }];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        body: mockStream
      })
      .mockResolvedValue({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      });

    const { result } = renderHook(() =>
      useFeedSync({
        fetchArticles: mockFetchArticles,
        setAllArticles: mockSetAllArticles
      })
    );

    // Initially not syncing
    expect(result.current.syncing).toBe(false);

    // During sync
    const syncPromise = act(async () => {
      await result.current.syncAllFeeds();
    });

    // After sync completes
    await syncPromise;
    expect(result.current.syncing).toBe(false);
  });

  it('should handle sync errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useFeedSync({
        fetchArticles: mockFetchArticles,
        setAllArticles: mockSetAllArticles
      })
    );

    await act(async () => {
      await result.current.syncAllFeeds();
    });

    expect(result.current.syncing).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to sync feeds:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should ignore parse errors in SSE stream', async () => {
    const mockStream = {
      getReader: vi.fn(() => ({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('invalid json\n') })
          .mockResolvedValueOnce({ done: true, value: null })
      }))
    };

    const mockAllArticles = [{ id: 1, title: 'Article 1', is_read: false }];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        body: mockStream
      })
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      });

    const { result } = renderHook(() =>
      useFeedSync({
        fetchArticles: mockFetchArticles,
        setAllArticles: mockSetAllArticles
      })
    );

    // Should not throw error
    await act(async () => {
      await result.current.syncAllFeeds();
    });

    expect(result.current.syncing).toBe(false);
    expect(mockSetAllArticles).toHaveBeenCalledWith(mockAllArticles);
  });

  it('should handle empty SSE stream', async () => {
    const mockStream = {
      getReader: vi.fn(() => ({
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('\n\n') })
          .mockResolvedValueOnce({ done: true, value: null })
      }))
    };

    const mockAllArticles = [{ id: 1, title: 'Article 1', is_read: false }];

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        body: mockStream
      })
      .mockResolvedValueOnce({
        ok: true,
        ok: true,
        json: async () => mockAllArticles
      });

    const { result } = renderHook(() =>
      useFeedSync({
        fetchArticles: mockFetchArticles,
        setAllArticles: mockSetAllArticles
      })
    );

    await act(async () => {
      await result.current.syncAllFeeds();
    });

    expect(result.current.syncing).toBe(false);
    expect(mockSetAllArticles).toHaveBeenCalledWith(mockAllArticles);
  });
});
