import React, { useState } from 'react';

function FeedList({ feeds, selectedFeed, onSelectFeed, onAddFeed, onDeleteFeed, onSyncFeed, onExport, onImport }) {
  const [newFeedUrl, setNewFeedUrl] = useState('');

  const handleAdd = () => {
    if (newFeedUrl.trim()) {
      onAddFeed(newFeedUrl);
      setNewFeedUrl('');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.opml,.xml';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          onImport(event.target.result);
        };
        reader.readAsText(file);
      }
    };
    input.click();
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
          <button onClick={handleAdd}>Add</button>
        </div>
        <div className="feed-actions">
          <button onClick={onExport} className="secondary-btn">📥 Export</button>
          <button onClick={handleImport} className="secondary-btn">📤 Import</button>
        </div>
      </div>
      <div className="feed-list">
        <div
          className={`feed-item all-feeds ${selectedFeed === null ? 'active' : ''}`}
          onClick={() => onSelectFeed(null)}
        >
          <span>📰 All Feeds</span>
        </div>
        {feeds.map(feed => (
          <div
            key={feed.id}
            className={`feed-item ${selectedFeed === feed.id ? 'active' : ''}`}
            onClick={() => onSelectFeed(feed.id)}
          >
            <span>{feed.title}</span>
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
