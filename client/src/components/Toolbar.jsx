import React from 'react';

function Toolbar({ onSortByAI, onGenerateDigest, onToggleUnread, showUnreadOnly, hasArticles, onCloseDigest, showingDigest, onOpenSettings }) {
  return (
    <div className="toolbar">
      <button onClick={onToggleUnread}>
        {showUnreadOnly ? 'Show All' : 'Show Unread'}
      </button>
      {showingDigest ? (
        <button onClick={onCloseDigest}>Back to Articles</button>
      ) : (
        <>
          <button onClick={onSortByAI} disabled={!hasArticles}>
            🤖 AI Sort
          </button>
          <button onClick={onGenerateDigest} disabled={!hasArticles}>
            📝 Generate Digest
          </button>
        </>
      )}
      <button onClick={onOpenSettings} className="settings-btn">⚙️ Settings</button>
    </div>
  );
}

export default Toolbar;
