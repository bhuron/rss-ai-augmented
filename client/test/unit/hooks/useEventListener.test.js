import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEventListener } from '../../../src/hooks/useEventListener.js';

describe('useEventListener', () => {
  it('should attach event listener to window by default', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const handler = vi.fn();

    renderHook(() => useEventListener('keydown', handler));

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    addSpy.mockRestore();
  });

  it('should attach event listener to custom element', () => {
    const mockElement = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const handler = vi.fn();

    renderHook(() => useEventListener('click', handler, mockElement));

    expect(mockElement.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('should call handler when event is triggered', () => {
    const handler = vi.fn();

    renderHook(() => useEventListener('keydown', handler));

    const event = new KeyboardEvent('keydown', { key: 'a' });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should update handler when handler function changes', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook(
      ({ handler }) => useEventListener('click', handler),
      { initialProps: { handler: handler1 } }
    );

    // Trigger event with first handler
    const event1 = new Event('click');
    window.dispatchEvent(event1);
    expect(handler1).toHaveBeenCalledTimes(1);

    // Change handler
    rerender({ handler: handler2 });

    // Trigger event with second handler
    const event2 = new Event('click');
    window.dispatchEvent(event2);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler1).toHaveBeenCalledTimes(1); // First handler not called again
  });

  it('should cleanup event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const handler = vi.fn();

    const { unmount } = renderHook(() => useEventListener('keydown', handler));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('should reattach listener when eventName changes', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const handler = vi.fn();

    const { rerender } = renderHook(
      ({ eventName }) => useEventListener(eventName, handler),
      { initialProps: { eventName: 'keydown' } }
    );

    rerender({ eventName: 'click' });

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
