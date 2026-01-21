import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArticleCard from '../../../src/components/ArticleCard';

describe('ArticleCard', () => {
  const mockArticle = {
    id: 1,
    title: 'Test Article',
    content: 'This is test content for the article.',
    link: 'https://example.com/article',
    pub_date: '2024-01-15T10:00:00Z',
    feed_id: 1,
    feed_title: 'Test Feed',
    is_read: false,
    is_saved: false,
    image_url: null,
  };

  const defaultProps = {
    article: mockArticle,
    isSelected: false,
    onClick: vi.fn(),
    onToggleSaved: vi.fn(),
    onMarkAsRead: vi.fn(),
    setRef: vi.fn(),
  };

  it('should render article content', () => {
    render(<ArticleCard {...defaultProps} />);

    expect(screen.getByText('Test Article')).toBeInTheDocument();
    expect(screen.getByText(/Test Feed/)).toBeInTheDocument();
    expect(screen.getByText(/This is test content/)).toBeInTheDocument();
  });

  it('should apply read class when article is read', () => {
    const { container } = render(
      <ArticleCard {...defaultProps} article={{ ...mockArticle, is_read: true }} />
    );

    expect(container.querySelector('.article-card.read')).toBeInTheDocument();
  });

  it('should apply selected class when isSelected is true', () => {
    const { container } = render(
      <ArticleCard {...defaultProps} isSelected={true} />
    );

    expect(container.querySelector('.article-card.selected')).toBeInTheDocument();
  });

  it('should call onClick when content wrapper is clicked', async () => {
    const user = userEvent.setup();
    render(<ArticleCard {...defaultProps} />);

    const contentWrapper = screen.getByText('Test Article').closest('.article-content-wrapper');
    await user.click(contentWrapper);

    expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
  });

  it('should call onToggleSaved when save button is clicked', async () => {
    const user = userEvent.setup();
    render(<ArticleCard {...defaultProps} />);

    const saveButton = screen.getByTitle('Read later');
    await user.click(saveButton);

    expect(defaultProps.onToggleSaved).toHaveBeenCalledWith(1, true);
  });

  it('should call onMarkAsRead when mark read button is clicked', async () => {
    const user = userEvent.setup();
    render(<ArticleCard {...defaultProps} />);

    const markReadButton = screen.getByTitle('Mark as read');
    await user.click(markReadButton);

    expect(defaultProps.onMarkAsRead).toHaveBeenCalledWith(1, true);
  });

  it('should render image when image_url is provided', () => {
    const articleWithImage = {
      ...mockArticle,
      image_url: 'https://example.com/image.jpg',
    };

    const { container } = render(
      <ArticleCard {...defaultProps} article={articleWithImage} />
    );

    expect(container.querySelector('.article-image')).toBeInTheDocument();
  });

  it('should use image-proxy for non-YouTube images', () => {
    const articleWithImage = {
      ...mockArticle,
      image_url: 'https://example.com/image.jpg',
    };

    const { container } = render(
      <ArticleCard {...defaultProps} article={articleWithImage} />
    );

    const img = container.querySelector('.article-image');
    expect(img.src).toContain('/api/image-proxy?url=');
  });

  it('should use direct URL for YouTube images', () => {
    const articleWithYouTubeImage = {
      ...mockArticle,
      image_url: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
    };

    const { container } = render(
      <ArticleCard {...defaultProps} article={articleWithYouTubeImage} />
    );

    const img = container.querySelector('.article-image');
    expect(img.src).toBe('https://img.youtube.com/vi/abc123/hqdefault.jpg');
  });

  it('should show video play overlay for YouTube videos', () => {
    const youtubeArticle = {
      ...mockArticle,
      link: 'https://www.youtube.com/watch?v=abc123',
      image_url: 'https://img.youtube.com/vi/abc123/hqdefault.jpg',
    };

    const { container } = render(
      <ArticleCard {...defaultProps} article={youtubeArticle} />
    );

    expect(container.querySelector('.video-play-overlay')).toBeInTheDocument();
  });

  it('should call setRef with article id and element', () => {
    render(<ArticleCard {...defaultProps} />);

    expect(defaultProps.setRef).toHaveBeenCalledWith(1, expect.any(HTMLDivElement));
  });

  it('should show saved style when article is saved', () => {
    const { container } = render(
      <ArticleCard {...defaultProps} article={{ ...mockArticle, is_saved: true }} />
    );

    expect(container.querySelector('.save-btn.saved')).toBeInTheDocument();
  });
});
