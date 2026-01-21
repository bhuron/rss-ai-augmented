import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing event listeners with automatic cleanup
 *
 * @param {string} eventName - The event to listen for
 * @param {Function} handler - The event handler function
 * @param {Element} element - The element to attach the listener to (default: window)
 *
 * @example
 * useEventListener('keydown', handleKeyDown);
 * useEventListener('click', handleClick, document);
 */
export function useEventListener(eventName, handler, element = window) {
  // Store handler in a ref to avoid re-attaching the listener on every render
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    // Create event listener with current handler from ref
    const eventListener = (event) => savedHandler.current(event);

    element.addEventListener(eventName, eventListener);

    // Cleanup: remove event listener on unmount or when dependencies change
    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}
