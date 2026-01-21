import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing timeouts with automatic cleanup
 *
 * @param {Function} callback - The function to call after delay
 * @param {number} delay - The timeout delay in ms
 * @returns {Object} Ref containing the timeout ID
 *
 * @example
 * const timeoutRef = useTimeout(() => {
 *   console.log('Timeout!');
 * }, 1000);
 */
export function useTimeout(callback, delay) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(callback, delay);

    // Cleanup: clear timeout on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [callback, delay]);

  return timeoutRef;
}
