import React, { useState } from 'react';

function FeedList({ feeds, selectedFeed, onSelectFeed, onAddFeed, onDeleteFeed, onSyncFeed, onRenameFeed }) {
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
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>RSS Feeds</h1>
        <div className="add-feed">
          <input
            type="text"
            placeholder="RSS feed URL"
            value={newFeedUrl}
            onChange={(e) => setNewFeedUrl(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd} title="Add feed">+</button>
        </div>
      </div>
      <div className="feed-list">
        <div
          className={`feed-item all-feeds ${selectedFeed === null ? 'active' : ''}`}
          onClick={() => onSelectFeed(null)}
        >
          <span>All Feeds</span>
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
            <div>
              <button onClick={(e) => { e.stopPropagation(); onSyncFeed(feed.id); }}>
                ↻
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDeleteFeed(feed.id); }}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FeedList;
