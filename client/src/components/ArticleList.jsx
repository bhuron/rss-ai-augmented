import { useEffect, useRef } from 'react';

function ArticleList({ articles, onMarkAsRead, categories }) {
  const observerRef = useRef(null);
  const articleRefs = useRef(new Map());

  useEffect(() => {
    // Create intersection observer to detect when articles are scrolled past
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If article has scrolled past the top of viewport and is unread
          if (entry.boundingClientRect.top < 0 && !entry.isIntersecting) {
            const articleId = parseInt(entry.target.dataset.articleId);
            const isRead = entry.target.dataset.isRead === 'true';
            
            if (!isRead) {
              // Mark as read after a short delay to ensure they actually scrolled past
              setTimeout(() => {
                onMarkAsRead(articleId, true);
              }, 500);
            }
          }
        });
      },
      {
        threshold: 0,
        rootMargin: '-50px 0px 0px 0px' // Trigger when article is 50px past top
      }
    );

    // Observe all article elements
    articleRefs.current.forEach((element) => {
      if (element) {
        observerRef.current.observe(element);
      }
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [articles, onMarkAsRead]);

  const setArticleRef = (id, element) => {
    if (element) {
      articleRefs.current.set(id, element);
    } else {
      articleRefs.current.delete(id);
    }
  };

  if (!articles || articles.length === 0) {
    return (
      <div className="article-list">
        <div className="loading">No articles found</div>
      </div>
    );
  }

  // If no categories, show articles normally
  if (!categories || categories.length === 0) {
    return (
      <div className="article-list">
        {articles.map(article => (
          <div
            key={article.id}
            ref={(el) => setArticleRef(article.id, el)}
            data-article-id={article.id}
            data-is-read={article.is_read}
            className={`article-card ${article.is_read ? 'read' : ''}`}
          >
            <div className="article-actions">
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
            <div 
              className="article-content-wrapper"
              onClick={() => {
                window.open(article.link, '_blank');
                if (!article.is_read) {
                  onMarkAsRead(article.id, true);
                }
              }}
            >
              <h3>{article.title}</h3>
              <div className="article-meta">
                {article.feed_title} • {new Date(article.pub_date).toLocaleDateString()}
              </div>
              <div className="article-content">
                {article.content?.substring(0, 200)}...
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Group articles by category
  const articleMap = new Map(articles.map(a => [a.id, a]));
  
  return (
    <div className="article-list">
      {categories.map((category, catIndex) => {
        const categoryArticles = category.articleIds
          .map(id => articleMap.get(id))
          .filter(a => a !== undefined);
        
        if (categoryArticles.length === 0) return null;
        
        return (
          <div key={catIndex} className="category-section">
            <div className="category-header">
              <h2>{category.name}</h2>
              <p>{category.description}</p>
            </div>
            {categoryArticles.map(article => (
              <div
                key={article.id}
                ref={(el) => setArticleRef(article.id, el)}
                data-article-id={article.id}
                data-is-read={article.is_read}
                className={`article-card ${article.is_read ? 'read' : ''}`}
              >
                <div className="article-actions">
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
                <div 
                  className="article-content-wrapper"
                  onClick={() => {
                    window.open(article.link, '_blank');
                    if (!article.is_read) {
                      onMarkAsRead(article.id, true);
                    }
                  }}
                >
                  <h3>{article.title}</h3>
                  <div className="article-meta">
                    {article.feed_title} • {new Date(article.pub_date).toLocaleDateString()}
                  </div>
                  <div className="article-content">
                    {article.content?.substring(0, 200)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default ArticleList;
