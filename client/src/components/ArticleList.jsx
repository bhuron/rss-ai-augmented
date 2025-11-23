import { useEffect, useRef, useState } from 'react';

function ArticleList({ articles, onMarkAsRead, onToggleSaved, categories }) {
  const observerRef = useRef(null);
  const articleRefs = useRef(new Map());
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build navigation list based on view type
  const getNavigationList = () => {
    if (!categories || categories.length === 0) {
      return articles;
    }
    // In category view, build flat list in category order
    const ordered = [];
    const articleMap = new Map(articles.map(a => [a.id, a]));
    const usedIds = new Set();
    
    categories.forEach(category => {
      category.articleIds?.forEach(id => {
        const article = articleMap.get(id);
        if (article && !usedIds.has(id)) {
          ordered.push(article);
          usedIds.add(id);
        }
      });
    });
    
    // Add any articles not in categories at the end
    articles.forEach(article => {
      if (!usedIds.has(article.id)) {
        ordered.push(article);
      }
    });
    
    return ordered;
  };

  const navigationList = getNavigationList();
  
  // Create index map for fast lookups
  const articleIndexMap = new Map();
  navigationList.forEach((article, index) => {
    articleIndexMap.set(article.id, index);
  });

  useEffect(() => {
    // Reset selection when articles or categories change
    setSelectedIndex(0);
  }, [articles.length, categories]);

  useEffect(() => {
    // Keyboard shortcuts for article navigation
    const navList = getNavigationList();
    
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      const currentArticle = navList[selectedIndex];
      const maxIndex = navList.length - 1;
      
      if (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'n') {
        e.preventDefault();
        // Mark current as read before moving
        if (currentArticle && !currentArticle.is_read) {
          onMarkAsRead(currentArticle.id, true);
        }
        if (selectedIndex < maxIndex) {
          const newIndex = selectedIndex + 1;
          setSelectedIndex(newIndex);
          const article = navList[newIndex];
          const element = articleRefs.current.get(article?.id);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex > 0) {
          const newIndex = selectedIndex - 1;
          setSelectedIndex(newIndex);
          const article = navList[newIndex];
          const element = articleRefs.current.get(article?.id);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (e.key === 'Enter' || e.key === 'o') {
        e.preventDefault();
        if (currentArticle) {
          window.open(currentArticle.link, '_blank');
          if (!currentArticle.is_read) {
            onMarkAsRead(currentArticle.id, true);
          }
        }
      } else if (e.key === 'v') {
        e.preventDefault();
        if (currentArticle) {
          window.open(currentArticle.link, '_blank');
        }
      } else if (e.key === 'm') {
        e.preventDefault();
        if (currentArticle) {
          onMarkAsRead(currentArticle.id, !currentArticle.is_read);
        }
      } else if (e.key === 's') {
        e.preventDefault();
        if (currentArticle) {
          onToggleSaved(currentArticle.id, !currentArticle.is_saved);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [articles, categories, selectedIndex, onMarkAsRead]);

  useEffect(() => {
    const markedIds = new Set();
    const timeouts = new Map();
    
    // Create intersection observer to detect when articles are scrolled past
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If article has scrolled past the top of viewport and is unread
          if (entry.boundingClientRect.top < 0 && !entry.isIntersecting) {
            const articleId = parseInt(entry.target.dataset.articleId);
            const isRead = entry.target.dataset.isRead === 'true';
            
            // Only mark if not already marked and not already read
            if (!markedIds.has(articleId) && !isRead) {
              markedIds.add(articleId);
              
              // Clear any existing timeout for this article
              if (timeouts.has(articleId)) {
                clearTimeout(timeouts.get(articleId));
              }
              
              // Mark as read after a short delay
              const timeout = setTimeout(() => {
                onMarkAsRead(articleId, true);
                timeouts.delete(articleId);
              }, 500);
              
              timeouts.set(articleId, timeout);
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
      // Clear all pending timeouts
      timeouts.forEach(timeout => clearTimeout(timeout));
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
            className={`article-card ${article.is_read ? 'read' : ''} ${navigationList.indexOf(article) === selectedIndex ? 'selected' : ''}`}
          >
            <div 
              className="article-content-wrapper"
              onClick={() => {
                window.open(article.link, '_blank');
                if (!article.is_read) {
                  onMarkAsRead(article.id, true);
                }
              }}
            >
              <div className="article-text">
                <h3>{article.title}</h3>
                <div className="article-meta">
                  {article.feed_title} • {new Date(article.pub_date).toLocaleDateString()}
                </div>
                <div className="article-content">
                  {article.content?.substring(0, 200)}...
                </div>
              </div>
              {article.image_url && (
                <img 
                  src={article.image_url} 
                  alt="" 
                  className="article-image" 
                  referrerPolicy="no-referrer"
                  onError={(e) => e.target.style.display = 'none'}
                />
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
            {categoryArticles.map((article, articleIndex) => (
              <div
                key={`${catIndex}-${article.id}`}
                ref={(el) => {
                  // Only set ref for the first occurrence of each article
                  if (!articleRefs.current.has(article.id)) {
                    setArticleRef(article.id, el);
                  }
                }}
                data-article-id={article.id}
                data-is-read={article.is_read}
                className={`article-card ${article.is_read ? 'read' : ''} ${articleIndexMap.get(article.id) === selectedIndex ? 'selected' : ''}`}
              >
                <div 
                  className="article-content-wrapper"
                  onClick={() => {
                    window.open(article.link, '_blank');
                    if (!article.is_read) {
                      onMarkAsRead(article.id, true);
                    }
                  }}
                >
                  <div className="article-text">
                    <h3>{article.title}</h3>
                    <div className="article-meta">
                      {article.feed_title} • {new Date(article.pub_date).toLocaleDateString()}
                    </div>
                    <div className="article-content">
                      {article.content?.substring(0, 200)}...
                    </div>
                  </div>
                  {article.image_url && (
                    <img 
                      src={article.image_url} 
                      alt="" 
                      className="article-image" 
                      referrerPolicy="no-referrer"
                      onError={(e) => e.target.style.display = 'none'}
                    />
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
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default ArticleList;
