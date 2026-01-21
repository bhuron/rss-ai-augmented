import { useEffect, useRef, useState, memo, useMemo } from 'react';
import { sanitizeHtml, stripHtml } from '../utils/sanitizeHtml.js';
import ArticleCard from './ArticleCard.jsx';
import { useAutoMarkAsRead } from '../hooks/useAutoMarkAsRead.js';

function ArticleList({ articles, onMarkAsRead, onToggleSaved, categories }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const prevArticlesLengthRef = useRef(0);
  const prevCategoriesRef = useRef(null);

  // Build navigation list based on view type
  const navigationList = useMemo(() => {
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
  }, [articles, categories]);

  // Create index map for fast lookups
  const articleIndexMap = useMemo(() => {
    const map = new Map();
    navigationList.forEach((article, index) => {
      map.set(article.id, index);
    });
    return map;
  }, [navigationList]);

  useEffect(() => {
    // Reset selection to first unread article only when article count actually changes
    // (e.g., new articles loaded) or when categories change (AI sort applied)
    const currentLength = articles.length;
    const categoriesChanged = prevCategoriesRef.current !== categories;

    if (currentLength !== prevArticlesLengthRef.current || categoriesChanged) {
      const firstUnreadIndex = navigationList.findIndex(a => !a.is_read);
      setSelectedIndex(firstUnreadIndex >= 0 ? firstUnreadIndex : 0);
      prevArticlesLengthRef.current = currentLength;
      prevCategoriesRef.current = categories;
    }
  }, [articles.length, categories]);

  // Auto-mark-as-read hook
  const { setArticleRef } = useAutoMarkAsRead({ articles, onMarkAsRead });

  useEffect(() => {
    // Keyboard shortcuts for article navigation
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const currentArticle = navigationList[selectedIndex];
      const maxIndex = navigationList.length - 1;
      
      if (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'n') {
        e.preventDefault();
        // Mark current as read before moving
        if (currentArticle && !currentArticle.is_read) {
          onMarkAsRead(currentArticle.id, true);
        }
        if (selectedIndex < maxIndex) {
          const newIndex = selectedIndex + 1;
          setSelectedIndex(newIndex);
          // For categorized view, find the selected element by class
          setTimeout(() => {
            const selectedElement = document.querySelector('.article-card.selected');
            selectedElement?.scrollIntoView({ behavior: 'auto', block: 'center' });
          }, 0);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex > 0) {
          const newIndex = selectedIndex - 1;
          setSelectedIndex(newIndex);
          // For categorized view, find the selected element by class
          setTimeout(() => {
            const selectedElement = document.querySelector('.article-card.selected');
            selectedElement?.scrollIntoView({ behavior: 'auto', block: 'center' });
          }, 0);
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
  }, [navigationList, selectedIndex, onMarkAsRead]);

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
          <ArticleCard
            key={article.id}
            article={article}
            isSelected={navigationList.indexOf(article) === selectedIndex}
            onClick={() => {
              window.open(article.link, '_blank');
              if (!article.is_read) {
                onMarkAsRead(article.id, true);
              }
            }}
            onToggleSaved={onToggleSaved}
            onMarkAsRead={onMarkAsRead}
            setRef={setArticleRef}
          />
        ))}
      </div>
    );
  }

  // Group articles by category
  const articleMap = useMemo(() => {
    return new Map(articles.map(a => [a.id, a]));
  }, [articles]);

  return (
    <div className="article-list">
      {categories.map((category, catIndex) => {
        // Special rendering for digest
        if (category.isDigest) {
          // Convert [ID:123] or [ID:123, ID:456, ID:789] references to clickable links
          const renderDigestWithLinks = (text) => {
            // Match both single [ID:123] and multiple [ID:123, ID:456, ...]
            const parts = text.split(/(\[(?:ID:\d+(?:,\s*)?)+\])/g);
            return parts.map((part, i) => {
              // Check if this is an ID reference block
              if (part.startsWith('[ID:')) {
                // Extract all IDs from the block
                const ids = [...part.matchAll(/ID:(\d+)/g)].map(m => parseInt(m[1]));
                const validArticles = ids.map(id => articleMap.get(id)).filter(a => a);
                
                if (validArticles.length === 0) return <span key={i}>{part}</span>;
                
                // Single article: show as subtle link indicator
                if (validArticles.length === 1) {
                  const article = validArticles[0];
                  return (
                    <span key={i} className="digest-article-tooltip">
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="digest-article-link"
                      >
                        🔗
                      </a>
                      <span className="digest-tooltip-text">{stripHtml(article.title)}</span>
                    </span>
                  );
                }
                
                // Multiple articles: show as compact numbered list
                return (
                  <span key={i} className="digest-article-group">
                    {validArticles.map((article, idx) => (
                      <span key={article.id} className="digest-article-tooltip">
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="digest-article-number"
                        >
                          [{idx + 1}]
                        </a>
                        <span className="digest-tooltip-text">{stripHtml(article.title)}</span>
                      </span>
                    ))}
                  </span>
                );
              }
              return <span key={i}>{part}</span>;
            });
          };
          
          return (
            <div key="digest" className="category-section digest-section">
              <div className="category-header digest-header">
                <h2>{category.name}</h2>
                <div className="digest-content">
                  {renderDigestWithLinks(category.description)}
                </div>
              </div>
            </div>
          );
        }
        
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
              <ArticleCard
                key={`${catIndex}-${article.id}`}
                article={article}
                isSelected={articleIndexMap.get(article.id) === selectedIndex}
                onClick={() => {
                  window.open(article.link, '_blank');
                  if (!article.is_read) {
                    onMarkAsRead(article.id, true);
                  }
                }}
                onToggleSaved={onToggleSaved}
                onMarkAsRead={onMarkAsRead}
                setRef={setArticleRef}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default memo(ArticleList);
