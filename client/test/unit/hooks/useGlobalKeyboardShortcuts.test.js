import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalKeyboardShortcuts } from '../../../src/hooks/useGlobalKeyboardShortcuts.js';

describe('useGlobalKeyboardShortcuts', () => {
  let mockSetCategories;
  let mockSyncAllFeeds;
  let mockFetchArticles;
  let mockHandleSelectFeed;
  let mockHandleSelectSaved;

  beforeEach(() => {
    mockSetCategories = vi.fn();
    mockSyncAllFeeds = vi.fn();
    mockFetchArticles = vi.fn();
    mockHandleSelectFeed = vi.fn();
    mockHandleSelectSaved = vi.fn();
  });

  it('should clear categories with c key and refetch articles', async () => {
    renderHook(() =>
      useGlobalKeyboardShortcuts({
        categories: [{ name: 'Category 1' }],
        setCategories: mockSetCategories,
        syncAllFeeds: mockSyncAllFeeds,
        fetchArticles: mockFetchArticles,
        handleSelectFeed: mockHandleSelectFeed,
        handleSelectSaved: mockHandleSelectSaved
      })
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'c' });
      window.dispatchEvent(event);
    });

    expect(mockSetCategories).toHaveBeenCalledWith(null);
    expect(mockFetchArticles).toHaveBeenCalled();
  });

  it('should not trigger c key when categories is null', async () => {
    renderHook(() =>
      useGlobalKeyboardShortcuts({
        categories: null,
        setCategories: mockSetCategories,
        syncAllFeeds: mockSyncAllFeeds,
        fetchArticles: mockFetchArticles,
        handleSelectFeed: mockHandleSelectFeed,
        handleSelectSaved: mockHandleSelectSaved
      })
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'c' });
      window.dispatchEvent(event);
    });

    expect(mockSetCategories).not.toHaveBeenCalled();
    expect(mockFetchArticles).not.toHaveBeenCalled();
  });

  it('should sync feeds with r key', async () => {
    renderHook(() =>
      useGlobalKeyboardShortcuts({
        categories: null,
        setCategories: mockSetCategories,
        syncAllFeeds: mockSyncAllFeeds,
        fetchArticles: mockFetchArticles,
        handleSelectFeed: mockHandleSelectFeed,
        handleSelectSaved: mockHandleSelectSaved
      })
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'r' });
      window.dispatchEvent(event);
    });

    expect(mockSyncAllFeeds).toHaveBeenCalledWith(true);
  });

  it('should select all feeds with a key', async () => {
    renderHook(() =>
      useGlobalKeyboardShortcuts({
        categories: null,
        setCategories: mockSetCategories,
        syncAllFeeds: mockSyncAllFeeds,
        fetchArticles: mockFetchArticles,
        handleSelectFeed: mockHandleSelectFeed,
        handleSelectSaved: mockHandleSelectSaved
      })
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'a' });
      window.dispatchEvent(event);
    });

    expect(mockHandleSelectFeed).toHaveBeenCalledWith(null);
  });

  it('should select saved with l key', async () => {
    renderHook(() =>
      useGlobalKeyboardShortcuts({
        categories: null,
        setCategories: mockSetCategories,
        syncAllFeeds: mockSyncAllFeeds,
        fetchArticles: mockFetchArticles,
        handleSelectFeed: mockHandleSelectFeed,
        handleSelectSaved: mockHandleSelectSaved
      })
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'l' });
      window.dispatchEvent(event);
    });

    expect(mockHandleSelectSaved).toHaveBeenCalled();
  });

  it('should not trigger shortcuts when typing in input', async () => {
    // Create an input element and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    renderHook(() =>
      useGlobalKeyboardShortcuts({
        categories: null,
        setCategories: mockSetCategories,
        syncAllFeeds: mockSyncAllFeeds,
        fetchArticles: mockFetchArticles,
        handleSelectFeed: mockHandleSelectFeed,
        handleSelectSaved: mockHandleSelectSaved
      })
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'r' });
      input.dispatchEvent(event);
    });

    expect(mockSyncAllFeeds).not.toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(input);
  });

  it('should not trigger shortcuts when typing in textarea', async () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    renderHook(() =>
      useGlobalKeyboardShortcuts({
        categories: null,
        setCategories: mockSetCategories,
        syncAllFeeds: mockSyncAllFeeds,
        fetchArticles: mockFetchArticles,
        handleSelectFeed: mockHandleSelectFeed,
        handleSelectSaved: mockHandleSelectSaved
      })
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'a' });
      textarea.dispatchEvent(event);
    });

    expect(mockHandleSelectFeed).not.toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(textarea);
  });

  it('should ignore other keys', async () => {
    renderHook(() =>
      useGlobalKeyboardShortcuts({
        categories: null,
        setCategories: mockSetCategories,
        syncAllFeeds: mockSyncAllFeeds,
        fetchArticles: mockFetchArticles,
        handleSelectFeed: mockHandleSelectFeed,
        handleSelectSaved: mockHandleSelectSaved
      })
    );

    await act(async () => {
      const event = new KeyboardEvent('keydown', { key: 'x' });
      window.dispatchEvent(event);
    });

    expect(mockSetCategories).not.toHaveBeenCalled();
    expect(mockSyncAllFeeds).not.toHaveBeenCalled();
    expect(mockHandleSelectFeed).not.toHaveBeenCalled();
    expect(mockHandleSelectSaved).not.toHaveBeenCalled();
  });
});
