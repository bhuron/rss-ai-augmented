import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArticleList from '../../../src/components/ArticleList.jsx';

// Mock IntersectionObserver
const mockDisconnect = vi.fn();
const mockObserve = vi.fn();

class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
}

global.IntersectionObserver = MockIntersectionObserver;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock window.open
global.open = vi.fn();

describe('Auto-mark-as-read behavior (Integration)', () => {
  let mockOnMarkAsRead;
  let mockOnToggleSaved;

  const mockArticles = [
    { id: 1, title: 'Article 1', content: 'Content 1', is_read: false, is_saved: false, link: 'http://example.com/1', pub_date: '2024-01-01', feed_id: 1, feed_title: 'Feed 1', image_url: null },
    { id: 2, title: 'Article 2', content: 'Content 2', is_read: false, is_saved: false, link: 'http://example.com/2', pub_date: '2024-01-02', feed_id: 1, feed_title: 'Feed 1', image_url: null },
    { id: 3, title: 'Article 3', content: 'Content 3', is_read: false, is_saved: false, link: 'http://example.com/3', pub_date: '2024-01-03', feed_id: 1, feed_title: 'Feed 1', image_url: null }
  ];

  beforeEach(() => {
    mockOnMarkAsRead = vi.fn();
    mockOnToggleSaved = vi.fn();
    mockObserve.mockClear();
    mockDisconnect.mockClear();
  });

  it('should render articles without marking as read initially', async () => {
    render(
      <ArticleList
        articles={mockArticles}
        onMarkAsRead={mockOnMarkAsRead}
        onToggleSaved={mockOnToggleSaved}
        categories={null}
      />
    );

    // Articles should be rendered
    expect(screen.getByText('Article 1')).toBeInTheDocument();
    expect(screen.getByText('Article 2')).toBeInTheDocument();
    expect(screen.getByText('Article 3')).toBeInTheDocument();

    // No articles should be marked as read initially
    expect(mockOnMarkAsRead).not.toHaveBeenCalled();
  });

  it('should mark article as read when clicked', async () => {
    render(
      <ArticleList
        articles={mockArticles}
        onMarkAsRead={mockOnMarkAsRead}
        onToggleSaved={mockOnToggleSaved}
        categories={null}
      />
    );

    const article1Card = screen.getByText('Article 1').closest('.article-card');
    const contentWrapper = article1Card.querySelector('.article-content-wrapper');
    await userEvent.click(contentWrapper);

    // Article should be marked as read when clicked (via window.open)
    expect(global.open).toHaveBeenCalledWith('http://example.com/1', '_blank');
    expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
  });

  it('should setup IntersectionObserver for articles', () => {
    render(
      <ArticleList
        articles={mockArticles}
        onMarkAsRead={mockOnMarkAsRead}
        onToggleSaved={mockOnToggleSaved}
        categories={null}
      />
    );

    // IntersectionObserver should be created
    expect(mockObserve).toHaveBeenCalled();
  });

  it('should cleanup IntersectionObserver on unmount', () => {
    const { unmount } = render(
      <ArticleList
        articles={mockArticles}
        onMarkAsRead={mockOnMarkAsRead}
        onToggleSaved={mockOnToggleSaved}
        categories={null}
      />
    );

    unmount();

    // IntersectionObserver should be disconnected
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should handle empty articles array', () => {
    render(
      <ArticleList
        articles={[]}
        onMarkAsRead={mockOnMarkAsRead}
        onToggleSaved={mockOnToggleSaved}
        categories={null}
      />
    );

    expect(screen.getByText('No articles found')).toBeInTheDocument();
  });
});
