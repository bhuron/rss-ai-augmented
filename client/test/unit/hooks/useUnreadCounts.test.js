import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnreadCounts } from '../../../src/hooks/useUnreadCounts.js';

describe('useUnreadCounts', () => {
  it('should calculate total unread count', () => {
    const mockArticles = [
      { id: 1, is_read: false, feed_id: 1 },
      { id: 2, is_read: false, feed_id: 1 },
      { id: 3, is_read: true, feed_id: 1 }
    ];

    const { result } = renderHook(() =>
      useUnreadCounts(mockArticles)
    );

    expect(result.current.total).toBe(2);
  });

  it('should calculate per-feed unread counts', () => {
    const mockArticles = [
      { id: 1, is_read: false, feed_id: 1 },
      { id: 2, is_read: false, feed_id: 1 },
      { id: 3, is_read: false, feed_id: 2 },
      { id: 4, is_read: true, feed_id: 2 }
    ];

    const { result } = renderHook(() =>
      useUnreadCounts(mockArticles)
    );

    expect(result.current[1]).toBe(2);
    expect(result.current[2]).toBe(1);
  });

  it('should return zero counts when all articles are read', () => {
    const mockArticles = [
      { id: 1, is_read: true, feed_id: 1 },
      { id: 2, is_read: true, feed_id: 1 }
    ];

    const { result } = renderHook(() =>
      useUnreadCounts(mockArticles)
    );

    expect(result.current.total).toBe(0);
    expect(result.current[1]).toBeUndefined();
  });

  it('should return zero counts when no articles', () => {
    const { result } = renderHook(() =>
      useUnreadCounts([])
    );

    expect(result.current.total).toBe(0);
  });

  it('should handle articles from multiple feeds', () => {
    const mockArticles = [
      { id: 1, is_read: false, feed_id: 1 },
      { id: 2, is_read: false, feed_id: 1 },
      { id: 3, is_read: true, feed_id: 1 },
      { id: 4, is_read: false, feed_id: 2 },
      { id: 5, is_read: true, feed_id: 2 },
      { id: 6, is_read: false, feed_id: 3 },
      { id: 7, is_read: false, feed_id: 3 },
      { id: 8, is_read: false, feed_id: 3 }
    ];

    const { result } = renderHook(() =>
      useUnreadCounts(mockArticles)
    );

    expect(result.current.total).toBe(6);
    expect(result.current[1]).toBe(2);
    expect(result.current[2]).toBe(1);
    expect(result.current[3]).toBe(3);
  });

  it('should memoize results when articles have not changed', () => {
    const mockArticles = [
      { id: 1, is_read: false, feed_id: 1 }
    ];

    const { result, rerender } = renderHook(() =>
      useUnreadCounts(mockArticles)
    );

    const firstResult = result.current;

    rerender();

    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });

  it('should recalculate when articles change', () => {
    const mockArticles = [
      { id: 1, is_read: false, feed_id: 1 }
    ];

    const { result, rerender } = renderHook(
      (articles) => useUnreadCounts(articles),
      { initialProps: mockArticles }
    );

    expect(result.current.total).toBe(1);

    const newArticles = [
      { id: 1, is_read: false, feed_id: 1 },
      { id: 2, is_read: false, feed_id: 1 }
    ];

    rerender(newArticles);

    expect(result.current.total).toBe(2);
  });
});
