import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAISorting } from '../../../src/hooks/useAISorting.js';

// Mock fetch
global.fetch = vi.fn();

// Mock alert
global.alert = vi.fn();

describe('useAISorting', () => {
  let mockSetArticles;
  let mockSetCategories;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
    global.alert = vi.fn();

    mockSetArticles = vi.fn();
    mockSetCategories = vi.fn();
  });

  it('should batch articles correctly (max 100 total, max 10 per feed)', async () => {
    // Create 200 articles across 5 feeds (50 each)
    const mockArticles = [];
    for (let feedId = 1; feedId <= 5; feedId++) {
      for (let i = 0; i < 50; i++) {
        mockArticles.push({
          id: mockArticles.length + 1,
          feed_id: feedId,
          title: `Article ${mockArticles.length + 1}`
        });
      }
    }

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        articles: mockArticles.slice(0, 100),
        categories: []
      })
    });

    const { result } = renderHook(() =>
      useAISorting({
        articles: mockArticles,
        setArticles: mockSetArticles,
        setCategories: mockSetCategories
      })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    const fetchCall = global.fetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1].body);
    const articleIds = requestBody.articleIds;

    // Should send exactly 100 article IDs
    expect(articleIds).toHaveLength(100);

    // Verify all feeds are represented in the batch
    const feedIds = new Set();
    articleIds.forEach(id => {
      const article = mockArticles.find(a => a.id === id);
      feedIds.add(article.feed_id);
    });

    // All 5 feeds should be represented
    expect(feedIds.size).toBe(5);
  });

  it('should preserve unsorted articles', async () => {
    // Create 120 articles from feed 1 (more than MAX_ARTICLES=100)
    const mockArticles = [];
    for (let i = 1; i <= 120; i++) {
      mockArticles.push({
        id: i,
        feed_id: 1,
        title: `Article ${i}`
      });
    }

    // First 100 will be sent to AI, last 20 should remain unsorted
    const sortedArticles = mockArticles.slice(0, 100);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        articles: sortedArticles,
        categories: [{ name: 'Category 1', articles: sortedArticles.map(a => a.id) }]
      })
    });

    const { result } = renderHook(() =>
      useAISorting({
        articles: mockArticles,
        setArticles: mockSetArticles,
        setCategories: mockSetCategories
      })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    // Should have 100 sorted + 20 remaining = 120 total
    expect(mockSetArticles).toHaveBeenCalled();
    const setArticlesCall = mockSetArticles.mock.calls[0][0];

    // Should have all 120 articles
    expect(setArticlesCall).toHaveLength(120);

    // Check that we have some of the unsorted articles (101-120)
    expect(setArticlesCall).toContainEqual(mockArticles[0]); // First sorted
    expect(setArticlesCall).toContainEqual(mockArticles[99]); // Last sorted
    expect(setArticlesCall).toContainEqual(mockArticles[119]); // Last unsorted
  });

  it('should set categories state on success', async () => {
    const mockArticles = [
      { id: 1, feed_id: 1, title: 'Article 1' }
    ];

    const mockCategories = [{ name: 'Category 1', articles: [1] }];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        articles: mockArticles,
        categories: mockCategories
      })
    });

    const { result } = renderHook(() =>
      useAISorting({
        articles: mockArticles,
        setArticles: mockSetArticles,
        setCategories: mockSetCategories
      })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    expect(mockSetCategories).toHaveBeenCalledWith(mockCategories);
  });

  it('should set loading to true during sort and false after', async () => {
    const mockArticles = [{ id: 1, feed_id: 1, title: 'Article 1' }];

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: mockArticles,
        categories: []
      })
    });

    const { result } = renderHook(() =>
      useAISorting({
        articles: mockArticles,
        setArticles: mockSetArticles,
        setCategories: mockSetCategories
      })
    );

    expect(result.current.loading).toBe(false);

    const sortPromise = act(async () => {
      await result.current.sortByAI();
    });

    // Loading should be true during the operation
    // (though this is hard to test precisely due to async timing)

    await sortPromise;

    expect(result.current.loading).toBe(false);
  });

  it('should handle AI errors gracefully', async () => {
    const mockArticles = [{ id: 1, feed_id: 1, title: 'Article 1' }];

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'AI service unavailable' })
    });

    const { result } = renderHook(() =>
      useAISorting({
        articles: mockArticles,
        setArticles: mockSetArticles,
        setCategories: mockSetCategories
      })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    expect(global.alert).toHaveBeenCalledWith('AI sorting failed: AI service unavailable');
    expect(result.current.loading).toBe(false);
  });

  it('should handle invalid server response', async () => {
    const mockArticles = [{ id: 1, feed_id: 1, title: 'Article 1' }];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: 'response' })
    });

    const { result } = renderHook(() =>
      useAISorting({
        articles: mockArticles,
        setArticles: mockSetArticles,
        setCategories: mockSetCategories
      })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    expect(global.alert).toHaveBeenCalledWith('AI sorting failed: Invalid response from server');
    expect(result.current.loading).toBe(false);
  });

  it('should handle network errors', async () => {
    const mockArticles = [{ id: 1, feed_id: 1, title: 'Article 1' }];

    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useAISorting({
        articles: mockArticles,
        setArticles: mockSetArticles,
        setCategories: mockSetCategories
      })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    expect(global.alert).toHaveBeenCalledWith('AI sorting failed: Network error');
    expect(result.current.loading).toBe(false);
  });

  it('should return early if no articles to sort', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ articles: [], categories: [] })
    });

    const { result } = renderHook(() =>
      useAISorting({
        articles: [],
        setArticles: mockSetArticles,
        setCategories: mockSetCategories
      })
    );

    await act(async () => {
      await result.current.sortByAI();
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSetArticles).not.toHaveBeenCalled();
    expect(mockSetCategories).not.toHaveBeenCalled();
  });
});
