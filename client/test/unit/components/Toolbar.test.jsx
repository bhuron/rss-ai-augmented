import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toolbar from '../../../src/components/Toolbar';

describe('Toolbar', () => {
  const defaultProps = {
    onSortByAI: vi.fn(),
    onToggleUnread: vi.fn(),
    showUnreadOnly: false,
    hasArticles: true,
    onOpenSettings: vi.fn(),
    onMarkAllAsRead: vi.fn(),
    hasUnread: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all buttons', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByTitle('AI Sort')).toBeInTheDocument();
    expect(screen.getByTitle('Show unread only')).toBeInTheDocument();
    expect(screen.getByTitle('Mark all as read')).toBeInTheDocument();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('should call onSortByAI when AI Sort button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toolbar {...defaultProps} />);

    const aiButton = screen.getByTitle('AI Sort');
    await user.click(aiButton);

    expect(defaultProps.onSortByAI).toHaveBeenCalledTimes(1);
  });

  it('should disable AI Sort button when no articles', () => {
    render(<Toolbar {...defaultProps} hasArticles={false} />);

    const aiButton = screen.getByTitle('AI Sort');
    expect(aiButton).toBeDisabled();
  });

  it('should call onToggleUnread when filter button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toolbar {...defaultProps} />);

    const filterButton = screen.getByTitle('Show unread only');
    await user.click(filterButton);

    expect(defaultProps.onToggleUnread).toHaveBeenCalledTimes(1);
  });

  it('should show correct filter icon when unread only', () => {
    render(<Toolbar {...defaultProps} showUnreadOnly={true} />);

    const filterButton = screen.getByTitle('Show all articles');
    expect(filterButton).toBeInTheDocument();
  });

  it('should call onMarkAllAsRead when mark all read button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toolbar {...defaultProps} />);

    const markReadButton = screen.getByTitle('Mark all as read');
    await user.click(markReadButton);

    expect(defaultProps.onMarkAllAsRead).toHaveBeenCalledTimes(1);
  });

  it('should disable mark all read button when no unread articles', () => {
    render(<Toolbar {...defaultProps} hasUnread={false} />);

    const markReadButton = screen.getByTitle('Mark all as read');
    expect(markReadButton).toBeDisabled();
  });

  it('should call onOpenSettings when settings button is clicked', async () => {
    const user = userEvent.setup();
    render(<Toolbar {...defaultProps} />);

    const settingsButton = screen.getByTitle('Settings');
    await user.click(settingsButton);

    expect(defaultProps.onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('should have correct button icons', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText('✨')).toBeInTheDocument();
    expect(screen.getByText('👁️‍🗨️')).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('⚙️')).toBeInTheDocument();
  });

  it('should change filter icon when showUnreadOnly changes', () => {
    const { rerender } = render(<Toolbar {...defaultProps} showUnreadOnly={false} />);
    expect(screen.getByTitle('Show unread only')).toBeInTheDocument();

    rerender(<Toolbar {...defaultProps} showUnreadOnly={true} />);
    expect(screen.getByTitle('Show all articles')).toBeInTheDocument();
  });
});
