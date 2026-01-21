import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for auto-marking articles as read when scrolled past
 *
 * Behavior:
 * - Articles are NOT marked as read until user first interacts (scrolls or clicks)
 * - After first interaction, scrolling past an article marks it as read after 500ms delay
 * - Each article is only marked once (tracked by ID)
 * - All timeouts are cleaned up on unmount
 *
 * @param {Object} params - Hook parameters
 * @param {Array} params.articles - Articles array (for length tracking)
 * @param {Function} params.onMarkAsRead - Callback to mark article as read
 * @returns {Object} { hasInteracted, setArticleRef }
 */
export function useAutoMarkAsRead({ articles, onMarkAsRead }) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const observerRef = useRef(null);
  const articleRefs = useRef(new Map());
  const markedIds = useRef(new Set());
  const timeouts = useRef(new Map());

  // Detect first user interaction (scroll or click)
  useEffect(() => {
    const handleInteraction = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
      }
    };

    window.addEventListener('scroll', handleInteraction, { once: true, passive: true });
    window.addEventListener('click', handleInteraction, { once: true });

    return () => {
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [hasInteracted]);

  // Reset interaction state when articles or categories change
  useEffect(() => {
    setHasInteracted(false);
  }, [articles.length]);

  // Intersection observer for auto-mark-as-read
  useEffect(() => {
    const markedIds = new Set();
    const timeouts = new Map();

    // Create intersection observer to detect when articles are scrolled past
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Only auto-mark after user has interacted with the page
          if (!hasInteracted) return;

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
  }, [articles, onMarkAsRead, hasInteracted]);

  const setArticleRef = (id, element) => {
    if (element) {
      articleRefs.current.set(id, element);
    } else {
      articleRefs.current.delete(id);
    }
  };

  return { hasInteracted, setArticleRef };
}
