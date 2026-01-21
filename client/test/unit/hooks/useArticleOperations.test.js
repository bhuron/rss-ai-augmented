import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArticleOperations } from '../../../src/hooks/useArticleOperations.js';

// Mock fetch
global.fetch = vi.fn();

describe('useArticleOperations', () => {
  let mockSetArticles;
  let mockSetAllArticles;
  let mockArticles;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();

    mockSetArticles = vi.fn();
    mockSetAllArticles = vi.fn();

    mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false },
      { id: 3, title: 'Article 3', is_read: true, is_saved: false }
    ];
  });

  it('should mark article as read', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true
    });

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: mockArticles
      })
    );

    await act(async () => {
      await result.current.markAsRead(1, true);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/articles/1/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true })
    });

    expect(mockSetArticles).toHaveBeenCalled();
    expect(mockSetAllArticles).toHaveBeenCalled();
  });

  it('should mark article as unread', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true
    });

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: mockArticles
      })
    );

    await act(async () => {
      await result.current.markAsRead(3, false);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/articles/3/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: false })
    });

    expect(mockSetArticles).toHaveBeenCalled();
    expect(mockSetAllArticles).toHaveBeenCalled();
  });

  it('should toggle saved status to saved', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true
    });

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: mockArticles
      })
    );

    await act(async () => {
      await result.current.toggleSaved(1, true);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/articles/1/saved', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSaved: true })
    });

    expect(mockSetArticles).toHaveBeenCalled();
    expect(mockSetAllArticles).toHaveBeenCalled();
  });

  it('should toggle saved status to unsaved', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true
    });

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: mockArticles
      })
    );

    await act(async () => {
      await result.current.toggleSaved(1, false);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/articles/1/saved', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSaved: false })
    });
  });

  it('should mark all articles as read', async () => {
    global.fetch.mockResolvedValue({
      ok: true
    });

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: mockArticles
      })
    );

    await act(async () => {
      await result.current.markAllAsRead();
    });

    // Should mark only unread articles (ids 1 and 2, not 3)
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith('/api/articles/1/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true })
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/articles/2/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true })
    });

    expect(mockSetArticles).toHaveBeenCalled();
    expect(mockSetAllArticles).toHaveBeenCalled();
  });

  it('should not mark any articles if all are already read', async () => {
    const allReadArticles = mockArticles.map(a => ({ ...a, is_read: true }));

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: allReadArticles
      })
    );

    await act(async () => {
      await result.current.markAllAsRead();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSetArticles).not.toHaveBeenCalled();
    expect(mockSetAllArticles).not.toHaveBeenCalled();
  });

  it('should update both articles and allArticles when marking as read', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true
    });

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: mockArticles
      })
    );

    await act(async () => {
      await result.current.markAsRead(1, true);
    });

    expect(mockSetArticles).toHaveBeenCalled();
    expect(mockSetAllArticles).toHaveBeenCalled();

    // Verify both state updaters were called
    expect(mockSetArticles).toHaveBeenCalledTimes(1);
    expect(mockSetAllArticles).toHaveBeenCalledTimes(1);
  });

  it('should update both articles and allArticles when toggling saved', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true
    });

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: mockArticles
      })
    );

    await act(async () => {
      await result.current.toggleSaved(1, true);
    });

    expect(mockSetArticles).toHaveBeenCalled();
    expect(mockSetAllArticles).toHaveBeenCalled();
  });

  it('should handle parallel updates for markAllAsRead', async () => {
    global.fetch.mockResolvedValue({
      ok: true
    });

    const { result } = renderHook(() =>
      useArticleOperations({
        setArticles: mockSetArticles,
        setAllArticles: mockSetAllArticles,
        articles: mockArticles
      })
    );

    await act(async () => {
      await result.current.markAllAsRead();
    });

    // Verify all fetch calls were made (they should be in parallel)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
