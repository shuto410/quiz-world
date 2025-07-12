/**
 * Hook for managing quiz timer
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseQuizTimerOptions {
  autoStart?: boolean;
  onExpire?: () => void;
}

export interface UseQuizTimerReturn {
  timeLeft: number;
  isExpired: boolean;
  start: () => void;
  stop: () => void;
  reset: (newTime?: number) => void;
}

export function useQuizTimer(
  initialTime: number,
  options: UseQuizTimerOptions = {}
): UseQuizTimerReturn {
  const { autoStart = false, onExpire } = options;
  
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [isExpired, setIsExpired] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onExpireRef = useRef(onExpire);

  // Update onExpire ref when it changes
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  // Update time when initialTime changes
  useEffect(() => {
    setTimeLeft(initialTime);
    setIsExpired(false);
  }, [initialTime]);

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsExpired(true);
            setIsRunning(false);
            if (onExpireRef.current) {
              onExpireRef.current();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  const start = useCallback(() => {
    if (timeLeft > 0) {
      setIsRunning(true);
    }
  }, [timeLeft]);

  const stop = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback((newTime?: number) => {
    setTimeLeft(newTime ?? initialTime);
    setIsExpired(false);
    setIsRunning(autoStart);
  }, [initialTime, autoStart]);

  return {
    timeLeft,
    isExpired,
    start,
    stop,
    reset,
  };
}