import React from 'react';

function Toolbar({ onSortByAI, onToggleUnread, showUnreadOnly, hasArticles, onOpenSettings, onMarkAllAsRead, hasUnread }) {
  return (
    <div className="toolbar">
      <div className="toolbar-inner">
        <button 
          onClick={onSortByAI} 
          disabled={!hasArticles}
          className="icon-btn"
          title="AI Sort"
        >
          ✨
        </button>
        <button 
          onClick={onToggleUnread}
          className="icon-btn"
          title={showUnreadOnly ? 'Show all articles' : 'Show unread only'}
        >
          {showUnreadOnly ? '👁️' : '👁️‍🗨️'}
        </button>

        <button 
          onClick={onMarkAllAsRead} 
          disabled={!hasUnread}
          className="icon-btn" 
          title="Mark all as read"
        >
          ✓
        </button>
        <button onClick={onOpenSettings} className="icon-btn" title="Settings">
          ⚙️
        </button>
      </div>
    </div>
  );
}

export default Toolbar;
