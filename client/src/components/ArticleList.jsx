import { useEffect, useRef, useState, memo, useMemo } from 'react';
import { sanitizeHtml, stripHtml } from '../utils/sanitizeHtml.js';
import ArticleCard from './ArticleCard.jsx';
import { useAutoMarkAsRead } from '../hooks/useAutoMarkAsRead.js';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation.js';

function ArticleList({ articles, onMarkAsRead, onToggleSaved, categories }) {
  // Keyboard navigation hook
  const { selectedIndex, navigationList, articleIndexMap, openArticle } = useKeyboardNavigation({
    articles,
    categories,
    onMarkAsRead,
    onToggleSaved
  });

  // Auto-mark-as-read hook
  const { setArticleRef } = useAutoMarkAsRead({ articles, onMarkAsRead });

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
            onClick={() => openArticle(article)}
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
                onClick={() => openArticle(article)}
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
