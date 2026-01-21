import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoMarkAsRead } from '../../../src/hooks/useAutoMarkAsRead.js';

describe('useAutoMarkAsRead', () => {
  let mockCallback;
  let mockObserve;
  let mockDisconnect;

  beforeEach(() => {
    mockCallback = null;
    mockObserve = vi.fn();
    mockDisconnect = vi.fn();

    // Mock IntersectionObserver as a class
    global.IntersectionObserver = class {
      constructor(callback, options) {
        mockCallback = callback;
      }
      observe(element) {
        mockObserve(element);
      }
      disconnect() {
        mockDisconnect();
      }
      unobserve() {
        // Not used in our implementation
      }
    };

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should create IntersectionObserver on mount', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];

    renderHook(() => useAutoMarkAsRead({ articles, onMarkAsRead }));

    expect(mockCallback).toBeTruthy();
  });

  it('should not mark articles as read before user interaction', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];
    const { result } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    // Set up article ref
    const mockElement = {
      dataset: { articleId: '1', isRead: 'false' }
    };
    result.current.setArticleRef(1, mockElement);

    // Trigger intersection callback (simulating scroll)
    mockCallback([{
      target: mockElement,
      boundingClientRect: { top: -100 },
      isIntersecting: false
    }]);

    // Fast-forward past 500ms
    vi.advanceTimersByTime(500);

    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it('should mark articles as read AFTER first user interaction', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];
    const { result } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    // Set up article ref
    const mockElement = {
      dataset: { articleId: '1', isRead: 'false' }
    };
    result.current.setArticleRef(1, mockElement);

    // Simulate scroll interaction
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // Trigger intersection callback
    act(() => {
      mockCallback([{
        target: mockElement,
        boundingClientRect: { top: -100 },
        isIntersecting: false
      }]);
    });

    // Fast-forward 500ms
    vi.advanceTimersByTime(500);

    expect(onMarkAsRead).toHaveBeenCalledWith(1, true);
  });

  it('should wait 500ms before marking as read', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];
    const { result } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    const mockElement = {
      dataset: { articleId: '1', isRead: 'false' }
    };
    result.current.setArticleRef(1, mockElement);

    // Simulate interaction
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // Trigger intersection
    act(() => {
      mockCallback([{
        target: mockElement,
        boundingClientRect: { top: -100 },
        isIntersecting: false
      }]);
    });

    // Should not be called immediately
    expect(onMarkAsRead).not.toHaveBeenCalled();

    // Should not be called after 400ms
    vi.advanceTimersByTime(400);
    expect(onMarkAsRead).not.toHaveBeenCalled();

    // Should be called after 500ms
    vi.advanceTimersByTime(100);
    expect(onMarkAsRead).toHaveBeenCalledWith(1, true);
  });

  it('should not mark same article twice', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];
    const { result } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    const mockElement = {
      dataset: { articleId: '1', isRead: 'false' }
    };
    result.current.setArticleRef(1, mockElement);

    // Simulate interaction
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // Trigger intersection twice
    act(() => {
      mockCallback([{
        target: mockElement,
        boundingClientRect: { top: -100 },
        isIntersecting: false
      }]);
    });

    vi.advanceTimersByTime(100);

    act(() => {
      mockCallback([{
        target: mockElement,
        boundingClientRect: { top: -200 },
        isIntersecting: false
      }]);
    });

    vi.advanceTimersByTime(500);

    expect(onMarkAsRead).toHaveBeenCalledTimes(1);
  });

  it('should not mark already read articles', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: true }];
    const { result } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    const mockElement = {
      dataset: { articleId: '1', isRead: 'true' }
    };
    result.current.setArticleRef(1, mockElement);

    // Simulate interaction
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // Trigger intersection
    act(() => {
      mockCallback([{
        target: mockElement,
        boundingClientRect: { top: -100 },
        isIntersecting: false
      }]);
    });

    vi.advanceTimersByTime(500);

    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it('should cleanup observer on unmount', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];
    const { unmount } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should cleanup all pending timeouts on unmount', () => {
    const onMarkAsRead = vi.fn();
    const articles = [
      { id: 1, is_read: false },
      { id: 2, is_read: false }
    ];
    const { result, unmount } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    const mockElement1 = {
      dataset: { articleId: '1', isRead: 'false' }
    };
    const mockElement2 = {
      dataset: { articleId: '2', isRead: 'false' }
    };
    result.current.setArticleRef(1, mockElement1);
    result.current.setArticleRef(2, mockElement2);

    // Simulate interaction
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // Trigger intersections for both articles
    act(() => {
      mockCallback([
        {
          target: mockElement1,
          boundingClientRect: { top: -100 },
          isIntersecting: false
        },
        {
          target: mockElement2,
          boundingClientRect: { top: -200 },
          isIntersecting: false
        }
      ]);
    });

    // Unmount before 500ms expires
    unmount();

    // Fast-forward past 500ms
    vi.advanceTimersByTime(600);

    // Should not have been called due to cleanup
    expect(onMarkAsRead).not.toHaveBeenCalled();
  });

  it('should reset interaction state when articles.length changes', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];
    const { result, rerender } = renderHook(
      ({ articles }) => useAutoMarkAsRead({ articles, onMarkAsRead }),
      { initialProps: { articles } }
    );

    // Simulate interaction
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.hasInteracted).toBe(true);

    // Change articles length
    rerender({ articles: [{ id: 1, is_read: false }, { id: 2, is_read: false }] });

    // Interaction state should be reset
    expect(result.current.hasInteracted).toBe(false);
  });

  it('should detect scroll interaction', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];
    const { result } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    expect(result.current.hasInteracted).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.hasInteracted).toBe(true);
  });

  it('should detect click interaction', () => {
    const onMarkAsRead = vi.fn();
    const articles = [{ id: 1, is_read: false }];
    const { result } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    expect(result.current.hasInteracted).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('click'));
    });

    expect(result.current.hasInteracted).toBe(true);
  });

  it('should handle multiple articles independently', () => {
    const onMarkAsRead = vi.fn();
    const articles = [
      { id: 1, is_read: false },
      { id: 2, is_read: false },
      { id: 3, is_read: false }
    ];
    const { result } = renderHook(() =>
      useAutoMarkAsRead({ articles, onMarkAsRead })
    );

    const mockElement1 = {
      dataset: { articleId: '1', isRead: 'false' }
    };
    const mockElement2 = {
      dataset: { articleId: '2', isRead: 'false' }
    };
    const mockElement3 = {
      dataset: { articleId: '3', isRead: 'false' }
    };
    result.current.setArticleRef(1, mockElement1);
    result.current.setArticleRef(2, mockElement2);
    result.current.setArticleRef(3, mockElement3);

    // Simulate interaction
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });

    // Trigger intersection for articles 1 and 3
    act(() => {
      mockCallback([
        {
          target: mockElement1,
          boundingClientRect: { top: -100 },
          isIntersecting: false
        },
        {
          target: mockElement3,
          boundingClientRect: { top: -300 },
          isIntersecting: false
        }
      ]);
    });

    vi.advanceTimersByTime(500);

    expect(onMarkAsRead).toHaveBeenCalledTimes(2);
    expect(onMarkAsRead).toHaveBeenCalledWith(1, true);
    expect(onMarkAsRead).toHaveBeenCalledWith(3, true);
  });
});
