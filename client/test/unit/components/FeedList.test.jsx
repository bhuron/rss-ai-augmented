import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedList from '../../../src/components/FeedList';

describe('FeedList', () => {
  const defaultProps = {
    feeds: [
      { id: 1, title: 'Tech Feed', url: 'https://example.com/feed' },
      { id: 2, title: 'News Feed', url: 'https://news.com/feed' }
    ],
    selectedFeed: null,
    showSavedOnly: false,
    onSelectFeed: vi.fn(),
    onSelectSaved: vi.fn(),
    onAddFeed: vi.fn(),
    onDeleteFeed: vi.fn(),
    onSyncFeed: vi.fn(),
    onRenameFeed: vi.fn(),
    unreadCounts: { 1: 5, 2: 3, total: 8 },
    sidebarOpen: true,
    onCloseSidebar: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all feeds', () => {
    render(<FeedList {...defaultProps} />);

    expect(screen.getByText('Tech Feed')).toBeInTheDocument();
    expect(screen.getByText('News Feed')).toBeInTheDocument();
  });

  it('should render "All Feeds" option', () => {
    render(<FeedList {...defaultProps} />);

    expect(screen.getByText('All Feeds')).toBeInTheDocument();
  });

  it('should render "Read Later" option', () => {
    render(<FeedList {...defaultProps} />);

    expect(screen.getByText('Read Later')).toBeInTheDocument();
  });

  it('should show unread count for All Feeds', () => {
    render(<FeedList {...defaultProps} unreadCounts={{ total: 8 }} />);

    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should show unread counts for individual feeds', () => {
    render(<FeedList {...defaultProps} />);

    const counts = screen.getAllByText('5');
    expect(counts.length).toBeGreaterThan(0);
  });

  it('should call onSelectFeed when All Feeds is clicked', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const allFeedsLink = screen.getByText('All Feeds');
    await user.click(allFeedsLink);

    expect(defaultProps.onSelectFeed).toHaveBeenCalledWith(null);
  });

  it('should call onSelectSaved when Read Later is clicked', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const savedLink = screen.getByText('Read Later');
    await user.click(savedLink);

    expect(defaultProps.onSelectSaved).toHaveBeenCalledTimes(1);
  });

  it('should call onAddFeed when URL is submitted', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const input = screen.getByPlaceholderText('RSS feed URL or YouTube channel URL');
    await user.type(input, 'https://newfeed.com/rss');
    await user.keyboard('{Enter}');

    expect(defaultProps.onAddFeed).toHaveBeenCalledWith('https://newfeed.com/rss');
  });

  it('should clear input after adding feed', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const input = screen.getByPlaceholderText('RSS feed URL or YouTube channel URL');
    await user.type(input, 'https://newfeed.com/rss');
    await user.click(screen.getByTitle('Add feed'));

    expect(input.value).toBe('');
  });

  it('should not add empty feed URL', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const addButton = screen.getByTitle('Add feed');
    await user.click(addButton);

    expect(defaultProps.onAddFeed).not.toHaveBeenCalled();
  });

  it('should call onSyncFeed when sync button is clicked', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const syncButtons = screen.getAllByText('↻');
    await user.click(syncButtons[0]);

    expect(defaultProps.onSyncFeed).toHaveBeenCalledWith(1);
  });

  it('should call onDeleteFeed when delete button is clicked', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const deleteButtons = screen.getAllByText('×');
    await user.click(deleteButtons[0]);

    expect(defaultProps.onDeleteFeed).toHaveBeenCalledWith(1);
  });

  it('should mark selected feed as active', () => {
    render(<FeedList {...defaultProps} selectedFeed={1} />);

    const techFeed = screen.getByText('Tech Feed');
    expect(techFeed.closest('.feed-item')).toHaveClass('active');
  });

  it('should mark All Feeds as active when no feed selected', () => {
    render(<FeedList {...defaultProps} selectedFeed={null} />);

    const allFeeds = screen.getByText('All Feeds');
    expect(allFeeds.closest('.feed-item')).toHaveClass('active');
  });

  it('should mark Read Later as active when showSavedOnly is true', () => {
    render(<FeedList {...defaultProps} showSavedOnly={true} />);

    const savedFeeds = screen.getByText('Read Later');
    expect(savedFeeds.closest('.feed-item')).toHaveClass('active');
  });

  it('should enter edit mode on double click', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const feedTitle = screen.getByText('Tech Feed');
    await user.dblClick(feedTitle);

    const input = screen.queryByDisplayValue('Tech Feed');
    expect(input).toBeInTheDocument();
  });

  it('should call onRenameFeed when edit is completed', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const feedTitle = screen.getByText('Tech Feed');
    await user.dblClick(feedTitle);

    const input = screen.getByDisplayValue('Tech Feed');
    await user.clear(input);
    await user.type(input, 'New Title');
    await user.keyboard('{Enter}');

    expect(defaultProps.onRenameFeed).toHaveBeenCalledWith(1, 'New Title');
  });

  it('should cancel rename on Escape key', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const feedTitle = screen.getByText('Tech Feed');
    await user.dblClick(feedTitle);

    const input = screen.getByDisplayValue('Tech Feed');
    await user.clear(input);
    await user.type(input, 'Cancelled');
    await user.keyboard('{Escape}');

    expect(defaultProps.onRenameFeed).not.toHaveBeenCalled();

    // Should still show original title
    await waitFor(() => {
      expect(screen.getByText('Tech Feed')).toBeInTheDocument();
    });
  });

  it('should not rename if title is empty', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} />);

    const feedTitle = screen.getByText('Tech Feed');
    await user.dblClick(feedTitle);

    const input = screen.getByDisplayValue('Tech Feed');
    await user.clear(input);
    await user.keyboard('{Enter}');

    expect(defaultProps.onRenameFeed).not.toHaveBeenCalled();
  });

  it('should apply open class when sidebar is open', () => {
    const { container } = render(<FeedList {...defaultProps} sidebarOpen={true} />);

    const sidebar = container.querySelector('.sidebar');
    expect(sidebar).toHaveClass('open');
  });

  it('should not apply open class when sidebar is closed', () => {
    const { container } = render(<FeedList {...defaultProps} sidebarOpen={false} />);

    const sidebar = container.querySelector('.sidebar');
    expect(sidebar).not.toHaveClass('open');
  });

  it('should show sidebar overlay when open', () => {
    const { container } = render(<FeedList {...defaultProps} sidebarOpen={true} />);

    const overlay = container.querySelector('.sidebar-overlay');
    expect(overlay).toBeInTheDocument();
  });

  it('should call onCloseSidebar when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<FeedList {...defaultProps} sidebarOpen={true} />);

    const overlay = screen.getByText('RSS Feeds').closest('.sidebar')?.previousElementSibling;
    await user.click(overlay);

    expect(defaultProps.onCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('should not show unread count if zero', () => {
    render(<FeedList {...defaultProps} unreadCounts={{ 1: 0, 2: 0, total: 0 }} />);

    // Should not show any zero counts
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('should handle empty feeds array', () => {
    render(<FeedList {...defaultProps} feeds={[]} />);

    expect(screen.getByText('All Feeds')).toBeInTheDocument();
    expect(screen.getByText('Read Later')).toBeInTheDocument();
  });
});
