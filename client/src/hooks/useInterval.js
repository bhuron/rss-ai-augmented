import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing intervals with automatic cleanup
 *
 * @param {Function} callback - The function to call on each interval
 * @param {number|null} delay - The interval delay in ms, or null to pause
 *
 * @example
 * useInterval(() => {
 *   console.log('Tick');
 * }, 1000);
 */
export function useInterval(callback, delay) {
  // Store callback in a ref to avoid re-creating interval on every render
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    // Don't set interval if delay is null (pauses the interval)
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);

    // Cleanup: clear interval on unmount or when delay changes
    return () => clearInterval(id);
  }, [delay]);
}
