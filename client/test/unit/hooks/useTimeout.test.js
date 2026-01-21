import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimeout } from '../../../src/hooks/useTimeout.js';

describe('useTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should set up timeout with specified delay', () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const callback = vi.fn();

    renderHook(() => useTimeout(callback, 1000));

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    setTimeoutSpy.mockRestore();
  });

  it('should call callback after delay', () => {
    const callback = vi.fn();

    renderHook(() => useTimeout(callback, 1000));

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback before delay', () => {
    const callback = vi.fn();

    renderHook(() => useTimeout(callback, 1000));

    vi.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should clear timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const callback = vi.fn();

    const { unmount } = renderHook(() => useTimeout(callback, 1000));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should reset timeout when callback changes', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(
      ({ callback }) => useTimeout(callback, 1000),
      { initialProps: { callback: callback1 } }
    );

    rerender({ callback: callback2 });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

    clearTimeoutSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('should reset timeout when delay changes', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    const callback = vi.fn();

    const { rerender } = renderHook(
      ({ delay }) => useTimeout(callback, delay),
      { initialProps: { delay: 1000 } }
    );

    rerender({ delay: 2000 });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);

    clearTimeoutSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('should return timeout ref', () => {
    const callback = vi.fn();

    const { result } = renderHook(() => useTimeout(callback, 1000));

    expect(result.current).toBeTruthy();
  });
});
