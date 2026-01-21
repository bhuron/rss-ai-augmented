import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFeedOperations } from '../../../src/hooks/useFeedOperations.js';

// Mock fetch
global.fetch = vi.fn();

describe('useFeedOperations', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty feeds array', () => {
    const { result } = renderHook(() => useFeedOperations());

    expect(result.current.feeds).toEqual([]);
    expect(result.current.setFeeds).toBeInstanceOf(Function);
  });

  it('should fetch feeds', async () => {
    const mockFeeds = [
      { id: 1, title: 'Feed 1', url: 'https://example.com/feed1.xml' },
      { id: 2, title: 'Feed 2', url: 'https://example.com/feed2.xml' }
    ];

    global.fetch.mockResolvedValueOnce({
        ok: true,
      json: async () => mockFeeds
    });

    const { result } = renderHook(() => useFeedOperations());

    await act(async () => {
      await result.current.fetchFeeds();
    });

    expect(result.current.feeds).toEqual(mockFeeds);
    expect(global.fetch).toHaveBeenCalledWith('/api/feeds');
  });

  it('should add feed', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
      json: async () => ({ id: 1, title: 'New Feed', url: 'https://example.com/feed.xml' })
    });

    // Mock fetchFeeds call
    const mockFeeds = [
      { id: 1, title: 'New Feed', url: 'https://example.com/feed.xml' }
    ];
    global.fetch.mockResolvedValueOnce({
        ok: true,
      json: async () => mockFeeds
    });

    const { result } = renderHook(() => useFeedOperations());

    await act(async () => {
      await result.current.addFeed('https://example.com/feed.xml');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/feed.xml' })
    });
  });

  it('should delete feed', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
      ok: true
    });

    // Mock fetchFeeds call
    const mockFeeds = [];
    global.fetch.mockResolvedValueOnce({
        ok: true,
      json: async () => mockFeeds
    });

    const setSelectedFeed = vi.fn();

    const { result } = renderHook(() => useFeedOperations());

    await act(async () => {
      await result.current.deleteFeed(1, 1, setSelectedFeed);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/feeds/1', { method: 'DELETE' });
    expect(setSelectedFeed).toHaveBeenCalledWith(null);
  });

  it('should delete feed without clearing selection if different feed selected', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
      ok: true
    });

    // Mock fetchFeeds call
    global.fetch.mockResolvedValueOnce({
        ok: true,
      json: async () => []
    });

    const setSelectedFeed = vi.fn();

    const { result } = renderHook(() => useFeedOperations());

    await act(async () => {
      await result.current.deleteFeed(1, 2, setSelectedFeed);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/feeds/1', { method: 'DELETE' });
    expect(setSelectedFeed).not.toHaveBeenCalled();
  });

  it('should delete feed without setSelectedFeed callback', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
      ok: true
    });

    // Mock fetchFeeds call
    global.fetch.mockResolvedValueOnce({
        ok: true,
      json: async () => []
    });

    const { result } = renderHook(() => useFeedOperations());

    await act(async () => {
      await result.current.deleteFeed(1, 1, undefined);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/feeds/1', { method: 'DELETE' });
  });

  it('should sync feed', async () => {
    global.fetch.mockResolvedValueOnce({
        ok: true,
      ok: true
    });

    const { result } = renderHook(() => useFeedOperations());

    await act(async () => {
      await result.current.syncFeed(1);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/feeds/1/sync', { method: 'POST' });
  });

  it('should rename feed with optimistic update', async () => {
    const mockFeeds = [
      { id: 1, title: 'Old Title', url: 'https://example.com/feed.xml' },
      { id: 2, title: 'Feed 2', url: 'https://example.com/feed2.xml' }
    ];

    const { result } = renderHook(() => useFeedOperations());

    // Initialize with feeds
    act(() => {
      result.current.setFeeds(mockFeeds);
    });

    expect(result.current.feeds[0].title).toBe('Old Title');

    global.fetch.mockResolvedValueOnce({
        ok: true,
      ok: true
    });

    await act(async () => {
      await result.current.renameFeed(1, 'New Title');
    });

    // Optimistic update should have changed the title immediately
    expect(result.current.feeds[0].title).toBe('New Title');
    expect(result.current.feeds[1].title).toBe('Feed 2'); // Other feed unchanged

    expect(global.fetch).toHaveBeenCalledWith('/api/feeds/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' })
    });
  });

  it('should export feeds', async () => {
    // Mock window.open
    const originalOpen = window.open;
    window.open = vi.fn();

    const { result } = renderHook(() => useFeedOperations());

    act(() => {
      result.current.exportFeeds();
    });

    expect(window.open).toHaveBeenCalledWith('/api/feeds/export', '_blank');

    // Restore original
    window.open = originalOpen;
  });

  it('should import feeds successfully', async () => {
    const mockResult = { imported: 5, failed: 0 };

    global.fetch.mockResolvedValueOnce({
        ok: true,
      json: async () => mockResult
    });

    // Mock fetchFeeds call
    global.fetch.mockResolvedValueOnce({
        ok: true,
      json: async () => []
    });

    // Mock alert
    const originalAlert = window.alert;
    window.alert = vi.fn();

    const { result } = renderHook(() => useFeedOperations());

    await act(async () => {
      await result.current.importFeeds('<opml>...</opml>');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/feeds/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opml: '<opml>...</opml>' })
    });

    expect(window.alert).toHaveBeenCalledWith('Import complete: 5 feeds imported, 0 failed');

    // Restore original
    window.alert = originalAlert;
  });

  it('should handle import error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    // Mock alert
    const originalAlert = window.alert;
    window.alert = vi.fn();

    const { result } = renderHook(() => useFeedOperations());

    await act(async () => {
      await expect(result.current.importFeeds('<opml>...</opml>')).rejects.toThrow('Network error');
    });

    expect(window.alert).toHaveBeenCalledWith('Import failed: Network error');

    // Restore original
    window.alert = originalAlert;
  });

  it('should provide setFeeds to manually update feeds', () => {
    const { result } = renderHook(() => useFeedOperations());

    const newFeeds = [
      { id: 1, title: 'Manual Feed', url: 'https://example.com/feed.xml' }
    ];

    act(() => {
      result.current.setFeeds(newFeeds);
    });

    expect(result.current.feeds).toEqual(newFeeds);
  });
});
