import { memo } from 'react';
import { stripHtml } from '../utils/sanitizeHtml.js';

/**
 * ArticleCard - Individual article display component
 *
 * Props:
 * @param {Object} article - The article object
 * @param {boolean} isSelected - Whether this article is currently selected
 * @param {Function} onClick - Click handler for opening article
 * @param {Function} onToggleSaved - Toggle saved status handler
 * @param {Function} onMarkAsRead - Mark as read/unread handler
 * @param {Function} setRef - Ref callback for intersection observer
 */
function ArticleCard({ article, isSelected, onClick, onToggleSaved, onMarkAsRead, setRef }) {
  const isYouTubeVideo = article.link?.includes('youtube.com/watch') || article.link?.includes('youtu.be/');

  return (
    <div
      ref={(el) => setRef?.(article.id, el)}
      data-article-id={article.id}
      data-is-read={article.is_read}
      className={`article-card ${article.is_read ? 'read' : ''} ${isSelected ? 'selected' : ''}`}
    >
      <div className="article-content-wrapper" onClick={onClick}>
        <div className="article-text">
          <h3>{stripHtml(article.title)}</h3>
          <div className="article-meta">
            {stripHtml(article.feed_title)} • {new Date(article.pub_date).toLocaleDateString()}
          </div>
          <div className="article-content">
            {stripHtml(article.content || '').substring(0, 200)}...
          </div>
        </div>
        {article.image_url && (
          <div className="article-image-container">
            <img
              src={article.image_url.includes('img.youtube.com') || article.image_url.includes('i.ytimg.com')
                ? article.image_url
                : `/api/image-proxy?url=${encodeURIComponent(article.image_url)}`}
              alt=""
              className="article-image"
              onError={(e) => e.target.style.display = 'none'}
            />
            {isYouTubeVideo && (
              <div className="video-play-overlay">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="article-actions">
        <button
          className={`save-btn ${article.is_saved ? 'saved' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSaved(article.id, !article.is_saved);
          }}
          title={article.is_saved ? 'Remove from read later' : 'Read later'}
        >
          <svg width="12" height="16" viewBox="0 0 12 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 0.5C0.723858 0.5 0.5 0.723858 0.5 1V15.5L6 12L11.5 15.5V1C11.5 0.723858 11.2761 0.5 11 0.5H1Z" stroke="currentColor" fill={article.is_saved ? 'currentColor' : 'none'}/>
          </svg>
        </button>
        <button
          className="mark-read-btn"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(article.id, !article.is_read);
          }}
          title={article.is_read ? 'Mark as unread' : 'Mark as read'}
        >
          {article.is_read ? '✓' : '○'}
        </button>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(ArticleCard);
