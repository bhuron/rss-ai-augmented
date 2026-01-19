import React, { useState } from 'react';

function FeedList({ feeds, selectedFeed, showSavedOnly, onSelectFeed, onSelectSaved, onAddFeed, onDeleteFeed, onSyncFeed, onRenameFeed, unreadCounts, sidebarOpen, onCloseSidebar }) {
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [editingFeedId, setEditingFeedId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleAdd = () => {
    if (newFeedUrl.trim()) {
      onAddFeed(newFeedUrl);
      setNewFeedUrl('');
    }
  };

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={onCloseSidebar} />}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h1>RSS Feeds</h1>
        <div className="add-feed">
          <input
            type="text"
            placeholder="RSS feed URL or YouTube channel URL"
            value={newFeedUrl}
            onChange={(e) => setNewFeedUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} title="Add feed">+</button>
        </div>
      </div>
      <div className="feed-list">
        <div
          className={`feed-item all-feeds ${selectedFeed === null && !showSavedOnly ? 'active' : ''}`}
          onClick={() => onSelectFeed(null)}
        >
          <span>All Feeds</span>
          {unreadCounts.total > 0 && (
            <span className="unread-count">{unreadCounts.total}</span>
          )}
        </div>
        <div
          className={`feed-item saved-feeds ${showSavedOnly ? 'active' : ''}`}
          onClick={onSelectSaved}
        >
          <span>Read Later</span>
        </div>
        {feeds.map(feed => (
          <div
            key={feed.id}
            className={`feed-item ${selectedFeed === feed.id ? 'active' : ''}`}
            onClick={() => onSelectFeed(feed.id)}
          >
            {editingFeedId === feed.id ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => {
                  if (editingTitle.trim()) {
                    onRenameFeed(feed.id, editingTitle.trim());
                  }
                  setEditingFeedId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingTitle.trim()) {
                      onRenameFeed(feed.id, editingTitle.trim());
                    }
                    setEditingFeedId(null);
                  } else if (e.key === 'Escape') {
                    setEditingFeedId(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="feed-rename-input"
              />
            ) : (
              <span onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingFeedId(feed.id);
                setEditingTitle(feed.title);
              }}>
                {feed.title}
              </span>
            )}
            <div className="feed-item-actions">
              <button onClick={(e) => { e.stopPropagation(); onSyncFeed(feed.id); }}>
                ↻
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDeleteFeed(feed.id); }}>
                ×
              </button>
            </div>
            {unreadCounts[feed.id] > 0 && (
              <span className="unread-count">{unreadCounts[feed.id]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
    </>
  );
}

export default FeedList;
