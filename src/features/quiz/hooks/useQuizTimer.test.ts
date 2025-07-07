/**
 * Tests for useQuizTimer hook
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizTimer } from './useQuizTimer';

describe('useQuizTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should initialize with given initial time', () => {
    const { result } = renderHook(() => useQuizTimer(30));
    
    expect(result.current.timeLeft).toBe(30);
    expect(result.current.isExpired).toBe(false);
  });

  test('should countdown when running', () => {
    const { result } = renderHook(() => useQuizTimer(5, { autoStart: true }));
    
    expect(result.current.timeLeft).toBe(5);
    
    // Advance timer by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.timeLeft).toBe(4);
    
    // Advance timer by 2 more seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    expect(result.current.timeLeft).toBe(2);
  });

  test('should stop at zero and set isExpired', () => {
    const { result } = renderHook(() => useQuizTimer(3, { autoStart: true }));
    
    // Advance timer by 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    
    expect(result.current.timeLeft).toBe(0);
    expect(result.current.isExpired).toBe(true);
    
    // Advance more, should stay at 0
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.timeLeft).toBe(0);
  });

  test('should call onExpire callback when timer expires', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => 
      useQuizTimer(2, { autoStart: true, onExpire })
    );
    
    expect(onExpire).not.toHaveBeenCalled();
    
    // Advance timer to expiry
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(result.current.isExpired).toBe(true);
  });

  test('should start timer when calling start', () => {
    const { result } = renderHook(() => useQuizTimer(5, { autoStart: false }));
    
    expect(result.current.timeLeft).toBe(5);
    
    // Timer should not be running
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.timeLeft).toBe(5);
    
    // Start timer
    act(() => {
      result.current.start();
    });
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.timeLeft).toBe(4);
  });

  test('should stop timer when calling stop', () => {
    const { result } = renderHook(() => useQuizTimer(5, { autoStart: true }));
    
    // Advance timer
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.timeLeft).toBe(4);
    
    // Stop timer
    act(() => {
      result.current.stop();
    });
    
    // Advance time, but timer should not change
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(result.current.timeLeft).toBe(4);
  });

  test('should reset timer when calling reset', () => {
    const { result } = renderHook(() => useQuizTimer(10, { autoStart: true }));
    
    // Advance timer
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    expect(result.current.timeLeft).toBe(5);
    
    // Reset timer
    act(() => {
      result.current.reset();
    });
    
    expect(result.current.timeLeft).toBe(10);
    expect(result.current.isExpired).toBe(false);
  });

  test('should reset to new time when provided', () => {
    const { result } = renderHook(() => useQuizTimer(10, { autoStart: true }));
    
    // Advance timer
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    expect(result.current.timeLeft).toBe(5);
    
    // Reset timer with new time
    act(() => {
      result.current.reset(20);
    });
    
    expect(result.current.timeLeft).toBe(20);
  });

  test('should update when initialTime prop changes', () => {
    const { result, rerender } = renderHook(
      ({ initialTime }) => useQuizTimer(initialTime),
      { initialProps: { initialTime: 10 } }
    );
    
    expect(result.current.timeLeft).toBe(10);
    
    // Change initial time
    rerender({ initialTime: 30 });
    
    expect(result.current.timeLeft).toBe(30);
  });

  test('should cleanup timer on unmount', () => {
    const { unmount } = renderHook(() => useQuizTimer(5, { autoStart: true }));
    
    unmount();
    
    // Advance timer after unmount, should not throw
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // No assertions needed, just ensuring no errors
  });
});