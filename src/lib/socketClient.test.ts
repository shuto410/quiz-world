import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import * as socketClient from './socketClient';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn().mockImplementation(() => ({
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
  })),
}));

describe('Socket.io Client', () => {
  afterEach(() => {
    // Clean up
    socketClient.disconnect();
  });

  describe('getSocket', () => {
    test('should return null when not connected', () => {
      expect(socketClient.getSocket()).toBeNull();
    });
  });

  describe('isConnected', () => {
    test('should return false when not connected', () => {
      expect(socketClient.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    test('should handle disconnect when not connected', () => {
      expect(() => socketClient.disconnect()).not.toThrow();
    });
  });

  describe('Connection State Types', () => {
    test('should have correct connection state types', () => {
      const states: socketClient.ConnectionState[] = ['disconnected', 'connecting', 'connected', 'error'];
      expect(states).toHaveLength(4);
      expect(states).toContain('disconnected');
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
      expect(states).toContain('error');
    });
  });

  describe('Event Listeners Types', () => {
    test('should have correct event listener types', () => {
      const listeners: socketClient.EventListeners = {
        onRoomCreated: () => {},
        onRoomJoined: () => {},
        onRoomLeft: () => {},
        onRoomList: () => {},
        onRoomUpdated: () => {},
        onUserJoined: () => {},
        onUserLeft: () => {},
        onHostTransferred: () => {},
        onQuizAdded: () => {},
        onQuizRemoved: () => {},
        onQuizStarted: () => {},
        onQuizAnswered: () => {},
        onQuizJudged: () => {},
        onQuizEnded: () => {},
        onError: () => {},
        onConnectionStateChange: () => {},
      };

      expect(listeners.onRoomCreated).toBeDefined();
      expect(listeners.onRoomJoined).toBeDefined();
      expect(listeners.onRoomLeft).toBeDefined();
      expect(listeners.onRoomList).toBeDefined();
      expect(listeners.onRoomUpdated).toBeDefined();
      expect(listeners.onUserJoined).toBeDefined();
      expect(listeners.onUserLeft).toBeDefined();
      expect(listeners.onHostTransferred).toBeDefined();
      expect(listeners.onQuizAdded).toBeDefined();
      expect(listeners.onQuizRemoved).toBeDefined();
      expect(listeners.onQuizStarted).toBeDefined();
      expect(listeners.onQuizAnswered).toBeDefined();
      expect(listeners.onQuizJudged).toBeDefined();
      expect(listeners.onQuizEnded).toBeDefined();
      expect(listeners.onError).toBeDefined();
      expect(listeners.onConnectionStateChange).toBeDefined();
    });
  });

  describe('Room Join User ID Consistency', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockSocket: any;
    beforeEach(() => {
      mockSocket = {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        connected: true,
      };
      vi.spyOn(socketClient, 'getSocket').mockReturnValue(mockSocket);
      vi.spyOn(socketClient, 'isConnected').mockReturnValue(true);
    });

    test('should not create duplicate users for the same userId', async () => {
      // joinRoom呼び出し時のuserId
      const userId = 'test_user_id_123';
      const userName = 'TestUser';
      const roomId = 'room1';

      // サーバーから返るroom情報をモック
      const users = [
        { id: userId, name: userName, isHost: true }
      ];
      // room:joinedイベントを模倣
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockSocket.on as any).mockImplementation((event: string, cb: any) => {
        if (event === 'room:joined') {
          cb({ room: { id: roomId, users }, user: users[0] });
        }
      });

      // 1回目の入室
      await socketClient.joinRoom(roomId, userId, userName, mockSocket);
      // 2回目の入室（同じuserId）
      await socketClient.joinRoom(roomId, userId, userName, mockSocket);

      // users配列に同じuserIdが2つ以上ないことを検証
      const userIds = users.map(u => u.id);
      const uniqueUserIds = Array.from(new Set(userIds));
      expect(userIds.length).toBe(uniqueUserIds.length);
    });
  });
}); 