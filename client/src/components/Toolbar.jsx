import React from 'react';

function Toolbar({ onSortByAI, onToggleUnread, showUnreadOnly, hasArticles, onOpenSettings }) {
  return (
    <div className="toolbar">
      <button onClick={onToggleUnread}>
        {showUnreadOnly ? 'Show All' : 'Show Unread'}
      </button>
      <button onClick={onSortByAI} disabled={!hasArticles}>
        🤖 AI Sort
      </button>
      <button onClick={onOpenSettings} className="settings-btn">⚙️ Settings</button>
    </div>
  );
}

export default Toolbar;
