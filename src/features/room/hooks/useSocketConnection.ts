/**
 * Socket connection management hook
 * Handles connection state and initialization
 */
import { useEffect, useState, useRef } from 'react';
import { initializeSocketClient, type ConnectionState } from '../../../lib/socketClient';

interface UseSocketConnectionOptions {
  reconnection?: boolean;
  timeout?: number;
  onConnectionStateChange?: (state: ConnectionState) => void;
  [key: string]: unknown;
}

interface UseSocketConnectionReturn {
  connectionState: ConnectionState;
  isConnected: boolean;
}

/**
 * Custom hook for managing Socket.io connection
 * @param options - Connection options
 * @returns Connection state and status
 */
export function useSocketConnection(
  options?: UseSocketConnectionOptions
): UseSocketConnectionReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const isMountedRef = useRef(true);
  const optionsRef = useRef(options);

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    isMountedRef.current = true;

    const initConnection = async () => {
      try {
        const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3002';
        
        await initializeSocketClient(serverUrl, {
          ...optionsRef.current,
          onConnectionStateChange: (state) => {
            if (isMountedRef.current) {
              setConnectionState(state);
              optionsRef.current?.onConnectionStateChange?.(state);
            }
          },
        });
      } catch (error) {
        console.error('Failed to initialize socket connection:', error);
        if (isMountedRef.current) {
          setConnectionState('error');
        }
      }
    };

    // Small delay to avoid immediate connection on page load
    const timer = setTimeout(initConnection, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
    };
  }, []); // Remove options from dependencies to prevent re-initialization

  return {
    connectionState,
    isConnected: connectionState === 'connected',
  };
}