import { useEffect, useState, useRef, useMemo } from 'react';
import { useEventListener } from './useEventListener.js';

/**
 * Custom hook for keyboard navigation through articles
 *
 * Features:
 * - j/k or Arrow keys: Navigate to next/previous article
 * - Enter/o: Open article and mark as read
 * - v: Open article without marking as read
 * - m: Toggle read status
 * - s: Toggle saved status
 * - Prevents event propagation to avoid global shortcut conflicts
 *
 * @param {Object} params - Hook parameters
 * @param {Array} params.articles - Articles array
 * @param {Array} params.categories - AI-sorted categories (optional)
 * @param {Function} params.onMarkAsRead - Mark article as read/unread callback
 * @param {Function} params.onToggleSaved - Toggle saved status callback
 * @returns {Object} { selectedIndex, navigationList, articleIndexMap, openArticle }
 */
export function useKeyboardNavigation({ articles, categories, onMarkAsRead, onToggleSaved }) {
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

  // Reset selection to first unread when articles change
  useEffect(() => {
    const currentLength = articles.length;
    const categoriesChanged = prevCategoriesRef.current !== categories;

    if (currentLength !== prevArticlesLengthRef.current || categoriesChanged) {
      const firstUnreadIndex = navigationList.findIndex(a => !a.is_read);
      setSelectedIndex(firstUnreadIndex >= 0 ? firstUnreadIndex : 0);
      prevArticlesLengthRef.current = currentLength;
      prevCategoriesRef.current = categories;
    }
  }, [articles.length, categories, navigationList]);

  // Keyboard shortcuts for article navigation
  useEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const currentArticle = navigationList[selectedIndex];
    const maxIndex = navigationList.length - 1;

    if (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'n') {
      e.preventDefault();
      e.stopPropagation();
      // Mark current as read before moving
      if (currentArticle && !currentArticle.is_read) {
        onMarkAsRead(currentArticle.id, true);
      }
      if (selectedIndex < maxIndex) {
        const newIndex = selectedIndex + 1;
        setSelectedIndex(newIndex);
        // Scroll selected element into view
        setTimeout(() => {
          const selectedElement = document.querySelector('.article-card.selected');
          selectedElement?.scrollIntoView({ behavior: 'auto', block: 'center' });
        }, 0);
      }
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (selectedIndex > 0) {
        const newIndex = selectedIndex - 1;
        setSelectedIndex(newIndex);
        // Scroll selected element into view
        setTimeout(() => {
          const selectedElement = document.querySelector('.article-card.selected');
          selectedElement?.scrollIntoView({ behavior: 'auto', block: 'center' });
        }, 0);
      }
    } else if (e.key === 'Enter' || e.key === 'o') {
      e.preventDefault();
      e.stopPropagation();
      if (currentArticle) {
        window.open(currentArticle.link, '_blank');
        if (!currentArticle.is_read) {
          onMarkAsRead(currentArticle.id, true);
        }
      }
    } else if (e.key === 'v') {
      e.preventDefault();
      e.stopPropagation();
      if (currentArticle) {
        window.open(currentArticle.link, '_blank');
      }
    } else if (e.key === 'm') {
      e.preventDefault();
      e.stopPropagation();
      if (currentArticle) {
        onMarkAsRead(currentArticle.id, !currentArticle.is_read);
      }
    } else if (e.key === 's') {
      e.preventDefault();
      e.stopPropagation();
      if (currentArticle) {
        onToggleSaved(currentArticle.id, !currentArticle.is_saved);
      }
    }
  });

  const openArticle = (article) => {
    window.open(article.link, '_blank');
    if (!article.is_read) {
      onMarkAsRead(article.id, true);
    }
  };

  return { selectedIndex, navigationList, articleIndexMap, openArticle };
}
