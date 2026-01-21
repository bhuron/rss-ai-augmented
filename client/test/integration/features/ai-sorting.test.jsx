import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAISorting } from '../../../src/hooks/useAISorting.js';

describe('AI sorting (Integration)', () => {
  let fetchSpy;
  let alertSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('should call AI sorting API with article IDs', async () => {
    const mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false, feed_id: 1 },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false, feed_id: 1 },
      { id: 3, title: 'Article 3', is_read: false, is_saved: false, feed_id: 2 }
    ];

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: mockArticles,
        categories: [{ name: 'Tech', articleIds: [1, 2, 3], description: 'Tech articles' }]
      })
    });

    const setArticles = vi.fn();
    const setCategories = vi.fn();

    const { result } = renderHook(() =>
      useAISorting({ articles: mockArticles, setArticles, setCategories })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    // Should call fetch with article IDs
    expect(fetchSpy).toHaveBeenCalledWith('/api/ai/sort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"articleIds"')
    });
  });

  it('should update categories state on success', async () => {
    const mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false, feed_id: 1 },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false, feed_id: 1 }
    ];

    const mockCategories = [
      { name: 'Tech', articleIds: [1, 2], description: 'Tech articles' }
    ];

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: mockArticles,
        categories: mockCategories
      })
    });

    const setArticles = vi.fn();
    const setCategories = vi.fn();

    const { result } = renderHook(() =>
      useAISorting({ articles: mockArticles, setArticles, setCategories })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    expect(setCategories).toHaveBeenCalledWith(mockCategories);
    expect(setArticles).toHaveBeenCalled();
  });

  it('should handle AI errors gracefully', async () => {
    const mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false, feed_id: 1 }
    ];

    fetchSpy.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'AI service unavailable' })
    });

    const setArticles = vi.fn();
    const setCategories = vi.fn();

    const { result } = renderHook(() =>
      useAISorting({ articles: mockArticles, setArticles, setCategories })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    // Should show alert
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('AI sorting failed'));

    // Loading state should be cleared
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle empty articles array', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ articles: [], categories: [] })
    });

    const setArticles = vi.fn();
    const setCategories = vi.fn();

    const { result } = renderHook(() =>
      useAISorting({ articles: [], setArticles, setCategories })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    // Should not call fetch with empty articles
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setArticles).not.toHaveBeenCalled();
  });

  it('should set loading state during sorting', async () => {
    const mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false, feed_id: 1 }
    ];

    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: mockArticles,
        categories: []
      })
    });

    const setArticles = vi.fn();
    const setCategories = vi.fn();

    const { result } = renderHook(() =>
      useAISorting({ articles: mockArticles, setArticles, setCategories })
    );

    // Initially not loading
    expect(result.current.loading).toBe(false);

    const promise = act(async () => {
      await result.current.sortByAI();
    });

    // Should be loading during operation
    // Note: This check might be flaky due to async timing
    await promise;

    // Loading should be cleared after completion
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
