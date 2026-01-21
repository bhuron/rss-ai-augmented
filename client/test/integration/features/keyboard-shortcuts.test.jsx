import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
const mockOpen = vi.fn();
global.open = mockOpen;

describe('Keyboard shortcuts (Integration)', () => {
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
    mockOpen.mockClear();
  });

  describe('Article navigation (ArticleList)', () => {
    it('should navigate to next article with j key', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      // First article should be selected initially
      expect(screen.getByText('Article 1')).toBeInTheDocument();

      // Press 'j' to move to next article
      await userEvent.keyboard('j');

      // Previous article should be marked as read
      expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);

      // Second article should now be selected (indicated by update)
      await waitFor(() => {
        expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
      });
    });

    it('should navigate to previous article with k key', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      // Press 'j' twice to move to third article
      await userEvent.keyboard('j');
      await userEvent.keyboard('j');

      // Press 'k' to go back to second article
      await userEvent.keyboard('k');

      // Should not mark as read when going back
      await waitFor(() => {
        expect(screen.getByText('Article 2')).toBeInTheDocument();
      });
    });

    it('should open article with Enter key', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      await act(async () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        window.dispatchEvent(event);
      });

      expect(mockOpen).toHaveBeenCalledWith('http://example.com/1', '_blank');
      expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
    });

    it('should toggle saved status with s key', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      await act(async () => {
        const event = new KeyboardEvent('keydown', { key: 's' });
        window.dispatchEvent(event);
      });

      expect(mockOnToggleSaved).toHaveBeenCalledWith(1, true);
    });

    it('should toggle read status with m key', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      await userEvent.keyboard('m');

      expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
    });

    it('should open with v key without marking as read', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      await userEvent.keyboard('v');

      expect(mockOpen).toHaveBeenCalledWith('http://example.com/1', '_blank');
      expect(mockOnMarkAsRead).not.toHaveBeenCalled();
    });
  });

  describe('Global shortcuts (integration with useGlobalKeyboardShortcuts)', () => {
    it('should work with ArrowDown key', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      await userEvent.keyboard('{ArrowDown}');

      expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
    });

    it('should work with ArrowUp key', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      // Move down first
      await userEvent.keyboard('{ArrowDown}');

      // Move back up
      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(screen.getByText('Article 1')).toBeInTheDocument();
      });
    });

    it('should work with o key to open', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      await userEvent.keyboard('o');

      expect(mockOpen).toHaveBeenCalledWith('http://example.com/1', '_blank');
      expect(mockOnMarkAsRead).toHaveBeenCalledWith(1, true);
    });
  });

  describe('Input field detection', () => {
    it('should not trigger shortcuts when typing in input', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      // Create an input element and focus it
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      // Press 'j' while input is focused
      await userEvent.keyboard('j');

      // Should NOT trigger navigation
      expect(mockOnMarkAsRead).not.toHaveBeenCalled();

      // Cleanup
      document.body.removeChild(input);
    });

    it('should not trigger shortcuts when typing in textarea', async () => {
      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      await userEvent.keyboard('m');

      expect(mockOnMarkAsRead).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });
  });

  describe('Event propagation', () => {
    it('should stop propagation of article navigation keys', async () => {
      let globalKeyDownFired = false;
      const globalHandler = (e) => {
        globalKeyDownFired = true;
      };
      window.addEventListener('keydown', globalHandler);

      render(
        <ArticleList
          articles={mockArticles}
          onMarkAsRead={mockOnMarkAsRead}
          onToggleSaved={mockOnToggleSaved}
          categories={null}
        />
      );

      await userEvent.keyboard('j');

      // The event should still propagate to window (article shortcuts don't stop propagation)
      expect(globalKeyDownFired).toBe(true);

      window.removeEventListener('keydown', globalHandler);
    });
  });
});
