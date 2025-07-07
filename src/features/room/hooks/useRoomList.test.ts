/**
 * Tests for useRoomList hook
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRoomList } from './useRoomList';
import * as socketClient from '../../../lib/socketClient';
import type { Room } from '../../../types';
import type { Socket } from 'socket.io-client';

// Mock socket client
vi.mock('../../../lib/socketClient', () => ({
  requestRoomList: vi.fn(),
  getSocket: vi.fn(),
}));

const mockRooms: Room[] = [
  {
    id: 'room-1',
    name: 'Test Room 1',
    isPublic: true,
    maxPlayers: 8,
    hostId: 'user-1',
    users: [{ id: 'user-1', name: 'Host', isHost: true }],
    quizzes: [],
  },
  {
    id: 'room-2',
    name: 'Test Room 2',
    isPublic: false,
    maxPlayers: 4,
    hostId: 'user-2',
    users: [{ id: 'user-2', name: 'Host2', isHost: true }],
    quizzes: [],
  },
];

describe('useRoomList', () => {
  let mockSocket: {
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
    };
    vi.mocked(socketClient.getSocket).mockReturnValue(mockSocket as unknown as Socket);
  });

  test('初期状態は空の配列でローディング中', () => {
    const { result } = renderHook(() => useRoomList(false));
    
    expect(result.current.rooms).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('接続時に自動的にルーム一覧を取得する', async () => {
    const mockRequestRoomList = vi.mocked(socketClient.requestRoomList);

    const { result } = renderHook(() => useRoomList(true));

    await waitFor(() => {
      expect(mockRequestRoomList).toHaveBeenCalled();
      expect(result.current.loading).toBe(true);
    });
  });

  test('未接続時はルーム一覧を取得しない', () => {
    const mockRequestRoomList = vi.mocked(socketClient.requestRoomList);

    renderHook(() => useRoomList(false));

    expect(mockRequestRoomList).not.toHaveBeenCalled();
  });

  test('ルーム一覧取得エラー時はエラーを設定する', async () => {
    const mockRequestRoomList = vi.mocked(socketClient.requestRoomList);
    mockRequestRoomList.mockImplementation(() => {
      throw new Error('Failed to fetch rooms');
    });

    const { result } = renderHook(() => useRoomList(true));

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch rooms');
      expect(result.current.loading).toBe(false);
    });
  });

  test('refreshでルーム一覧を再取得できる', async () => {
    const mockRequestRoomList = vi.mocked(socketClient.requestRoomList);

    const { result } = renderHook(() => useRoomList(true));

    await waitFor(() => {
      expect(mockRequestRoomList).toHaveBeenCalledTimes(1);
    });

    // Clear mock
    mockRequestRoomList.mockClear();

    // Refresh rooms
    act(() => {
      result.current.refresh();
    });

    expect(mockRequestRoomList).toHaveBeenCalledTimes(1);
  });

  test('未接続時のrefreshはエラーを設定する', () => {
    const mockRequestRoomList = vi.mocked(socketClient.requestRoomList);

    const { result } = renderHook(() => useRoomList(false));

    act(() => {
      result.current.refresh();
    });

    expect(mockRequestRoomList).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Not connected to server');
  });

  test('リアルタイムアップデートを受信できる', async () => {
    const { result } = renderHook(() => useRoomList(true));

    // Get the room:list handler
    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];

    // Simulate receiving room list
    act(() => {
      roomListHandler?.({ rooms: mockRooms });
    });

    expect(result.current.rooms).toEqual(mockRooms);
    expect(result.current.loading).toBe(false);
  });

  test('フィルター関数でルームを絞り込める', async () => {
    const filterPublicRooms = (room: Room) => room.isPublic;
    
    const { result } = renderHook(() => 
      useRoomList(true, { filter: filterPublicRooms })
    );

    // Get the room:list handler
    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];

    // Simulate receiving room list
    act(() => {
      roomListHandler?.({ rooms: mockRooms });
    });

    expect(result.current.rooms).toHaveLength(1);
    expect(result.current.rooms[0].id).toBe('room-1');
  });

  test('ソート機能でルームを並び替えられる', async () => {
    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'name', sortOrder: 'desc' })
    );

    // Get the room:list handler
    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];

    // Simulate receiving room list
    act(() => {
      roomListHandler?.({ rooms: mockRooms });
    });

    expect(result.current.rooms[0].id).toBe('room-2');
    expect(result.current.rooms[1].id).toBe('room-1');
  });

  test('コンポーネントのアンマウント時にクリーンアップされる', () => {
    const { unmount } = renderHook(() => useRoomList(true));
    
    // Check that event listeners were registered
    expect(mockSocket.on).toHaveBeenCalledWith('room:list', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('room:created', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('room:updated', expect.any(Function));
    
    unmount();
    
    // Check that event listeners were removed
    expect(mockSocket.off).toHaveBeenCalledWith('room:list', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('room:created', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('room:updated', expect.any(Function));
  });
});