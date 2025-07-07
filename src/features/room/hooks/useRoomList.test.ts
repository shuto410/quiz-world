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

  test('errorイベントを受信したときエラーを設定する', async () => {
    const { result } = renderHook(() => useRoomList(true));

    // Get the error handler
    const errorHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'error'
    )?.[1];

    // Simulate error event
    act(() => {
      errorHandler?.({ message: 'Server error occurred' });
    });

    expect(result.current.error).toBe('Server error occurred');
    expect(result.current.loading).toBe(false);
  });

  test('room:createdイベントで新しいルームが追加される', async () => {
    const { result } = renderHook(() => useRoomList(true));

    // Set initial rooms
    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: [mockRooms[0]] });
    });

    // Get the room:created handler
    const roomCreatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:created'
    )?.[1];

    // Simulate new room created
    const newRoom: Room = {
      id: 'room-3',
      name: 'New Room',
      isPublic: true,
      maxPlayers: 6,
      hostId: 'user-3',
      users: [{ id: 'user-3', name: 'Host3', isHost: true }],
      quizzes: [],
    };

    act(() => {
      roomCreatedHandler?.({ room: newRoom });
    });

    expect(result.current.rooms).toHaveLength(2);
    expect(result.current.rooms.find(r => r.id === 'room-3')).toBeDefined();
  });

  test('room:createdイベントでフィルターが適用される', async () => {
    const filterPublicRooms = (room: Room) => room.isPublic;
    
    const { result } = renderHook(() => 
      useRoomList(true, { filter: filterPublicRooms })
    );

    // Get the room:created handler
    const roomCreatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:created'
    )?.[1];

    // Simulate private room created
    const privateRoom: Room = {
      id: 'room-private',
      name: 'Private Room',
      isPublic: false,
      maxPlayers: 4,
      hostId: 'user-p',
      users: [{ id: 'user-p', name: 'HostP', isHost: true }],
      quizzes: [],
    };

    act(() => {
      roomCreatedHandler?.({ room: privateRoom });
    });

    // Private room should not be added
    expect(result.current.rooms.find(r => r.id === 'room-private')).toBeUndefined();
  });

  test('room:createdイベントでソートが適用される', async () => {
    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'name', sortOrder: 'asc' })
    );

    // Set initial rooms
    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: mockRooms });
    });

    // Get the room:created handler
    const roomCreatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:created'
    )?.[1];

    // Add room that should be sorted in the middle
    const newRoom: Room = {
      id: 'room-3',
      name: 'Test Room 1.5',
      isPublic: true,
      maxPlayers: 6,
      hostId: 'user-3',
      users: [{ id: 'user-3', name: 'Host3', isHost: true }],
      quizzes: [],
    };

    act(() => {
      roomCreatedHandler?.({ room: newRoom });
    });

    expect(result.current.rooms[0].name).toBe('Test Room 1');
    expect(result.current.rooms[1].name).toBe('Test Room 1.5');
    expect(result.current.rooms[2].name).toBe('Test Room 2');
  });

  test('room:updatedイベントでルーム情報が更新される', async () => {
    const { result } = renderHook(() => useRoomList(true));

    // Set initial rooms
    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: mockRooms });
    });

    // Get the room:updated handler
    const roomUpdatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:updated'
    )?.[1];

    // Update room
    const updatedRoom: Room = {
      ...mockRooms[0],
      name: 'Updated Room Name',
      users: [...mockRooms[0].users, { id: 'user-new', name: 'New User', isHost: false }],
    };

    act(() => {
      roomUpdatedHandler?.({ room: updatedRoom });
    });

    const room = result.current.rooms.find(r => r.id === 'room-1');
    expect(room?.name).toBe('Updated Room Name');
    expect(room?.users).toHaveLength(2);
  });

  test('room:updatedイベントでフィルターが再適用される', async () => {
    const filterLargeRooms = (room: Room) => room.users.length >= 2;
    
    const { result } = renderHook(() => 
      useRoomList(true, { filter: filterLargeRooms })
    );

    // Set initial rooms - one with 2 users that passes filter
    const initialRooms: Room[] = [
      { 
        ...mockRooms[0], 
        users: [
          { id: 'user-1', name: 'Host', isHost: true },
          { id: 'user-2', name: 'Player', isHost: false },
        ]
      },
      mockRooms[1], // This has only 1 user
    ];

    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: initialRooms });
    });

    expect(result.current.rooms).toHaveLength(1); // Only room-1 has 2+ users

    // Get the room:updated handler
    const roomUpdatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:updated'
    )?.[1];

    // Update room to have fewer users (should be filtered out)
    const updatedRoom: Room = {
      ...initialRooms[0],
      users: [{ id: 'user-1', name: 'Host', isHost: true }],
    };

    act(() => {
      roomUpdatedHandler?.({ room: updatedRoom });
    });

    expect(result.current.rooms).toHaveLength(0); // Room no longer passes filter
  });

  test('playerCountでソートできる', async () => {
    const roomsWithDifferentPlayerCounts: Room[] = [
      { ...mockRooms[0], users: [{ id: 'u1', name: 'U1', isHost: true }] },
      { ...mockRooms[1], users: [
        { id: 'u2', name: 'U2', isHost: true },
        { id: 'u3', name: 'U3', isHost: false },
        { id: 'u4', name: 'U4', isHost: false },
      ]},
    ];

    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'playerCount', sortOrder: 'desc' })
    );

    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];

    act(() => {
      roomListHandler?.({ rooms: roomsWithDifferentPlayerCounts });
    });

    expect(result.current.rooms[0].users).toHaveLength(3);
    expect(result.current.rooms[1].users).toHaveLength(1);
  });

  test('createdAtでソートできる', async () => {
    const roomsWithDifferentIds: Room[] = [
      { ...mockRooms[0], id: 'room-2023-01-01' },
      { ...mockRooms[1], id: 'room-2023-01-02' },
    ];

    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'createdAt', sortOrder: 'asc' })
    );

    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];

    act(() => {
      roomListHandler?.({ rooms: roomsWithDifferentIds });
    });

    expect(result.current.rooms[0].id).toBe('room-2023-01-01');
    expect(result.current.rooms[1].id).toBe('room-2023-01-02');
  });

  test('autoFetch=falseの場合は自動取得しない', () => {
    const mockRequestRoomList = vi.mocked(socketClient.requestRoomList);
    mockRequestRoomList.mockClear();

    renderHook(() => useRoomList(true, { autoFetch: false }));

    expect(mockRequestRoomList).not.toHaveBeenCalled();
  });

  test('切断時に状態がリセットされる', async () => {
    const { result, rerender } = renderHook(
      ({ isConnected }) => useRoomList(isConnected),
      { initialProps: { isConnected: true } }
    );

    // Set some rooms
    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: mockRooms });
    });

    expect(result.current.rooms).toHaveLength(2);

    // Disconnect
    rerender({ isConnected: false });

    await waitFor(() => {
      expect(result.current.rooms).toHaveLength(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  test('room:createdイベントでplayerCountソートが適用される', async () => {
    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'playerCount', sortOrder: 'desc' })
    );

    // Set initial rooms with different player counts
    const initialRooms: Room[] = [
      { ...mockRooms[0], users: [{ id: 'u1', name: 'U1', isHost: true }] },
      { ...mockRooms[1], users: [
        { id: 'u2', name: 'U2', isHost: true },
        { id: 'u3', name: 'U3', isHost: false },
        { id: 'u4', name: 'U4', isHost: false },
      ]},
    ];

    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: initialRooms });
    });

    // Get the room:created handler
    const roomCreatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:created'
    )?.[1];

    // Add room with 2 players
    const newRoom: Room = {
      id: 'room-3',
      name: 'New Room',
      isPublic: true,
      maxPlayers: 6,
      hostId: 'user-3',
      users: [
        { id: 'user-3', name: 'Host3', isHost: true },
        { id: 'user-4', name: 'Player4', isHost: false },
      ],
      quizzes: [],
    };

    act(() => {
      roomCreatedHandler?.({ room: newRoom });
    });

    // Should be sorted by player count desc: 3, 2, 1
    expect(result.current.rooms[0].users).toHaveLength(3);
    expect(result.current.rooms[1].users).toHaveLength(2);
    expect(result.current.rooms[2].users).toHaveLength(1);
  });

  test('room:createdイベントでcreatedAtソートが適用される', async () => {
    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'createdAt', sortOrder: 'desc' })
    );

    // Set initial rooms
    const initialRooms: Room[] = [
      { ...mockRooms[0], id: 'room-2023-01-01' },
      { ...mockRooms[1], id: 'room-2023-01-03' },
    ];

    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: initialRooms });
    });

    // Get the room:created handler
    const roomCreatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:created'
    )?.[1];

    // Add room with middle date
    const newRoom: Room = {
      id: 'room-2023-01-02',
      name: 'New Room',
      isPublic: true,
      maxPlayers: 6,
      hostId: 'user-3',
      users: [{ id: 'user-3', name: 'Host3', isHost: true }],
      quizzes: [],
    };

    act(() => {
      roomCreatedHandler?.({ room: newRoom });
    });

    // Should be sorted by createdAt desc
    expect(result.current.rooms[0].id).toBe('room-2023-01-03');
    expect(result.current.rooms[1].id).toBe('room-2023-01-02');
    expect(result.current.rooms[2].id).toBe('room-2023-01-01');
  });

  test('room:updatedイベントでplayerCountソートが再適用される', async () => {
    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'playerCount', sortOrder: 'asc' })
    );

    // Set initial rooms
    const initialRooms: Room[] = [
      { ...mockRooms[0], users: [{ id: 'u1', name: 'U1', isHost: true }] },
      { ...mockRooms[1], users: [
        { id: 'u2', name: 'U2', isHost: true },
        { id: 'u3', name: 'U3', isHost: false },
      ]},
    ];

    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: initialRooms });
    });

    // Get the room:updated handler
    const roomUpdatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:updated'
    )?.[1];

    // Update first room to have most players
    const updatedRoom: Room = {
      ...initialRooms[0],
      users: [
        { id: 'u1', name: 'U1', isHost: true },
        { id: 'u4', name: 'U4', isHost: false },
        { id: 'u5', name: 'U5', isHost: false },
      ],
    };

    act(() => {
      roomUpdatedHandler?.({ room: updatedRoom });
    });

    // Should be sorted by player count asc: 2, 3
    expect(result.current.rooms[0].users).toHaveLength(2);
    expect(result.current.rooms[1].users).toHaveLength(3);
  });

  test('room:updatedイベントでcreatedAtソートが再適用される', async () => {
    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'createdAt', sortOrder: 'asc' })
    );

    // Set initial rooms
    const initialRooms: Room[] = [
      { ...mockRooms[0], id: 'room-2023-01-01' },
      { ...mockRooms[1], id: 'room-2023-01-02' },
    ];

    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: initialRooms });
    });

    // Get the room:updated handler
    const roomUpdatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:updated'
    )?.[1];

    // Update room (ID shouldn't change but we test the sorting logic)
    const updatedRoom: Room = {
      ...initialRooms[0],
      name: 'Updated Name',
    };

    act(() => {
      roomUpdatedHandler?.({ room: updatedRoom });
    });

    // Should maintain sort order
    expect(result.current.rooms[0].id).toBe('room-2023-01-01');
    expect(result.current.rooms[1].id).toBe('room-2023-01-02');
  });

  test('room:updatedイベントでnameソートが再適用される', async () => {
    const { result } = renderHook(() => 
      useRoomList(true, { sortBy: 'name', sortOrder: 'asc' })
    );

    // Set initial rooms
    const roomListHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:list'
    )?.[1];
    act(() => {
      roomListHandler?.({ rooms: mockRooms });
    });

    // Get the room:updated handler
    const roomUpdatedHandler = mockSocket.on.mock.calls.find(
      call => call[0] === 'room:updated'
    )?.[1];

    // Update room name to change sort order
    const updatedRoom: Room = {
      ...mockRooms[1],
      name: 'AAA Room',
    };

    act(() => {
      roomUpdatedHandler?.({ room: updatedRoom });
    });

    // Should be re-sorted by name
    expect(result.current.rooms[0].name).toBe('AAA Room');
    expect(result.current.rooms[1].name).toBe('Test Room 1');
  });
});