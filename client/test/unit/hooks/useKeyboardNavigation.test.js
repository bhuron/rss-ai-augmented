import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation } from '../../../src/hooks/useKeyboardNavigation.js';

describe('useKeyboardNavigation', () => {
  let mockOnMarkAsRead;
  let mockOnToggleSaved;
  let mockArticles;
  let scrollIntoViewMock;

  beforeEach(() => {
    mockOnMarkAsRead = vi.fn();
    mockOnToggleSaved = vi.fn();

    mockArticles = [
      { id: 1, title: 'Article 1', is_read: false, is_saved: false, link: 'https://example.com/1' },
      { id: 2, title: 'Article 2', is_read: false, is_saved: false, link: 'https://example.com/2' },
      { id: 3, title: 'Article 3', is_read: false, is_saved: false, link: 'https://example.com/3' }
    ];

    // Mock window.open
    global.window.open = vi.fn();

    // Mock scrollIntoView
    scrollIntoViewMock = vi.fn();
    global.document.querySelector = vi.fn(() => ({
      scrollIntoView: scrollIntoViewMock
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with first unread article selected', () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.navigationList).toEqual(mockArticles);
  });

  it('should initialize with first article if all are read', () => {
    const allReadArticles = mockArticles.map(a => ({ ...a, is_read: true }));

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: allReadArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    expect(result.current.selectedIndex).toBe(0);
  });

  it('should navigate to next article with j key', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    expect(result.current.selectedIndex).toBe(0);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });

    expect(result.current.selectedIndex).toBe(1);
    expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
  });

  it('should navigate to previous article with k key', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    // Navigate to second article first
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });

    expect(result.current.selectedIndex).toBe(1);

    // Now navigate back to first
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });

    expect(result.current.selectedIndex).toBe(0);
  });

  it('should navigate with ArrowDown', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });

    expect(result.current.selectedIndex).toBe(1);
  });

  it('should navigate with ArrowUp', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    // Navigate to second article first
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });

    expect(result.current.selectedIndex).toBe(1);

    // Now navigate back
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });

    expect(result.current.selectedIndex).toBe(0);
  });

  it('should open article with Enter key and mark as read', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(window.open).toHaveBeenCalledWith('https://example.com/1', '_blank');
    expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
  });

  it('should open article with o key and mark as read', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' }));
    });

    expect(window.open).toHaveBeenCalledWith('https://example.com/1', '_blank');
    expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
  });

  it('should open article with v key without marking as read', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    });

    expect(window.open).toHaveBeenCalledWith('https://example.com/1', '_blank');
    expect(mockOnMarkAsRead).not.toHaveBeenCalled();
  });

  it('should toggle read status with m key', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    });

    expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true); // Toggle from false to true
  });

  it('should toggle saved status with s key', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    });

    expect(mockOnToggleSaved).toHaveBeenCalledWith(1, true); // Toggle from false to true
  });

  it('should not navigate beyond article list boundaries', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    // Try to go before first article
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });

    expect(result.current.selectedIndex).toBe(0);

    // Navigate to last article (index 0 -> 1 -> 2)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });
    expect(result.current.selectedIndex).toBe(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });
    expect(result.current.selectedIndex).toBe(2);

    // Try to go beyond last article
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });

    expect(result.current.selectedIndex).toBe(2); // Should stay at 2
  });

  it('should reset selection when articles length changes', async () => {
    const { result, rerender } = renderHook(
      ({ articles }) => useKeyboardNavigation({
        articles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      }),
      { initialProps: { articles: mockArticles } }
    );

    expect(result.current.selectedIndex).toBe(0);

    // Add more articles
    const newArticles = [
      ...mockArticles,
      { id: 4, title: 'Article 4', is_read: false, is_saved: false, link: 'https://example.com/4' }
    ];

    rerender({ articles: newArticles });

    expect(result.current.navigationList).toHaveLength(4);
  });

  it('should build navigation list in category order', async () => {
    const categories = [
      {
        name: 'Category 1',
        articleIds: [2, 1]
      }
    ];

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        categories,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    expect(result.current.navigationList[0].id).toBe(2);
    expect(result.current.navigationList[1].id).toBe(1);
    expect(result.current.navigationList[2].id).toBe(3); // Uncategorized at end
  });

  it('should provide articleIndexMap for fast lookups', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    expect(result.current.articleIndexMap.get(1)).toBe(0);
    expect(result.current.articleIndexMap.get(2)).toBe(1);
    expect(result.current.articleIndexMap.get(3)).toBe(2);
  });

  it('should provide openArticle helper function', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    act(() => {
      result.current.openArticle(mockArticles[0]);
    });

    expect(window.open).toHaveBeenCalledWith('https://example.com/1', '_blank');
    expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
  });

  it('should not trigger shortcuts when typing in input', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    // Create input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });

    expect(result.current.selectedIndex).toBe(0); // Should not navigate
    expect(mockOnMarkAsRead).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('should not trigger shortcuts when typing in textarea', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: mockArticles,
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    // Create textarea element
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    act(() => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    });

    expect(result.current.selectedIndex).toBe(0); // Should not navigate
    expect(mockOnMarkAsRead).not.toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('should handle empty articles array', async () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        articles: [],
        onMarkAsRead: mockOnMarkAsRead,
        onToggleSaved: mockOnToggleSaved
      })
    );

    expect(result.current.navigationList).toEqual([]);
    expect(result.current.selectedIndex).toBe(0);
  });
});
