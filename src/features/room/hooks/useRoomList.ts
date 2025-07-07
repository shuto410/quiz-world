import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket, requestRoomList } from '@/lib/socketClient';
import type { Room } from '@/types';

export interface UseRoomListOptions {
  autoFetch?: boolean;
  filter?: (room: Room) => boolean;
  sortBy?: 'name' | 'playerCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface UseRoomListReturn {
  rooms: Room[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRoomList(
  isConnected: boolean,
  options: UseRoomListOptions = {}
): UseRoomListReturn {
  const {
    autoFetch = true,
    filter,
    sortBy,
    sortOrder = 'asc'
  } = options;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  // Refresh function
  const refresh = useCallback(() => {
    if (!isConnected) {
      setError('Not connected to server');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      requestRoomList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms');
      setLoading(false);
    }
  }, [isConnected]);

  // Auto-fetch on connection
  useEffect(() => {
    if (isConnected && autoFetch && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      refresh();
    }
  }, [isConnected, autoFetch, refresh]);

  // Set up socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRoomList = (data: { rooms: Room[] }) => {
      let processedRooms = [...data.rooms];

      // Apply filter if provided
      if (filter) {
        processedRooms = processedRooms.filter(filter);
      }

      // Apply sorting if specified
      if (sortBy) {
        processedRooms.sort((a, b) => {
          let compareValue = 0;
          
          switch (sortBy) {
            case 'name':
              compareValue = a.name.localeCompare(b.name);
              break;
            case 'playerCount':
              compareValue = a.users.length - b.users.length;
              break;
            case 'createdAt':
              // Assuming rooms have IDs that are chronological
              compareValue = a.id.localeCompare(b.id);
              break;
          }

          return sortOrder === 'asc' ? compareValue : -compareValue;
        });
      }

      setRooms(processedRooms);
      setLoading(false);
      setError(null);
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
      setLoading(false);
    };

    // Handle individual room updates
    const handleRoomCreated = (data: { room: Room }) => {
      setRooms(prevRooms => {
        const newRooms = [...prevRooms, data.room];
        
        // Apply filter to new room
        if (filter && !filter(data.room)) {
          return prevRooms;
        }

        // Re-sort if needed
        if (sortBy) {
          newRooms.sort((a, b) => {
            let compareValue = 0;
            
            switch (sortBy) {
              case 'name':
                compareValue = a.name.localeCompare(b.name);
                break;
              case 'playerCount':
                compareValue = a.users.length - b.users.length;
                break;
              case 'createdAt':
                compareValue = a.id.localeCompare(b.id);
                break;
            }

            return sortOrder === 'asc' ? compareValue : -compareValue;
          });
        }

        return newRooms;
      });
    };

    const handleRoomUpdated = (data: { room: Room }) => {
      setRooms(prevRooms => {
        let newRooms = prevRooms.map(room => 
          room.id === data.room.id ? data.room : room
        );

        // Re-apply filter
        if (filter) {
          newRooms = newRooms.filter(filter);
        }

        // Re-sort if needed
        if (sortBy) {
          newRooms.sort((a, b) => {
            let compareValue = 0;
            
            switch (sortBy) {
              case 'name':
                compareValue = a.name.localeCompare(b.name);
                break;
              case 'playerCount':
                compareValue = a.users.length - b.users.length;
                break;
              case 'createdAt':
                compareValue = a.id.localeCompare(b.id);
                break;
            }

            return sortOrder === 'asc' ? compareValue : -compareValue;
          });
        }

        return newRooms;
      });
    };

    // Subscribe to events
    socket.on('room:list', handleRoomList);
    socket.on('error', handleError);
    socket.on('room:created', handleRoomCreated);
    socket.on('room:updated', handleRoomUpdated);

    // Cleanup
    return () => {
      socket.off('room:list', handleRoomList);
      socket.off('error', handleError);
      socket.off('room:created', handleRoomCreated);
      socket.off('room:updated', handleRoomUpdated);
    };
  }, [filter, sortBy, sortOrder]);

  // Reset state on disconnect
  useEffect(() => {
    if (!isConnected) {
      setRooms([]);
      setLoading(false);
      setError(null);
      hasFetchedRef.current = false;
    }
  }, [isConnected]);

  return {
    rooms,
    loading,
    error,
    refresh
  };
}