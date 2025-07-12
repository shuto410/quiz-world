import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as socketClient from './socketClient';
import { io } from 'socket.io-client';
import type { Quiz, Room, User } from '@/types';

// socket.io-client全体をモックする
vi.mock('socket.io-client', () => {
  const mockSocket = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    connected: false,
  };
  return {
    io: vi.fn(() => mockSocket),
  };
});

describe('Socket.io Client', () => {
  let mockSocket: any;

  beforeEach(() => {
    // ioのモックが返すオブジェクトを取得
    mockSocket = io();
    // 接続状態をテストケースごとに制御できるようにする
    mockSocket.connected = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
    socketClient.disconnect(); // 各テストの後に切断してクリーンアップ
  });

  describe('initializeSocketClient', () => {
    it('should initialize socket connection and set up listeners', () => {
      const serverUrl = 'http://localhost:3002';
      socketClient.initializeSocketClient(serverUrl);

      expect(io).toHaveBeenCalledWith(serverUrl, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should resolve promise when connected', async () => {
      const serverUrl = 'http://localhost:3002';
      const listeners = {
        onConnectionStateChange: vi.fn(),
      };

      const promise = socketClient.initializeSocketClient(serverUrl, listeners);

      // connectイベントハンドラを取得して実行
      const connectHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'connect')?.[1];
      connectHandler?.();

      await expect(promise).resolves.toBeUndefined();
      expect(listeners.onConnectionStateChange).toHaveBeenCalledWith('connecting');
      expect(listeners.onConnectionStateChange).toHaveBeenCalledWith('connected');
    });

    it('should reject promise on connection error', async () => {
      const serverUrl = 'http://localhost:3002';
      const listeners = {
        onConnectionStateChange: vi.fn(),
      };

      const promise = socketClient.initializeSocketClient(serverUrl, listeners);

      // connect_errorイベントハンドラを取得して実行
      const errorHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'connect_error')?.[1];
      const error = new Error('Connection failed');
      errorHandler?.(error);

      await expect(promise).rejects.toThrow('Connection failed');
      expect(listeners.onConnectionStateChange).toHaveBeenCalledWith('error');
    });

    it('should handle disconnect event', () => {
      const listeners = {
        onConnectionStateChange: vi.fn(),
      };

      socketClient.initializeSocketClient('http://localhost:3002', listeners);

      // disconnectイベントハンドラを取得して実行
      const disconnectHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'disconnect')?.[1];
      disconnectHandler?.();

      expect(listeners.onConnectionStateChange).toHaveBeenCalledWith('disconnected');
    });

    it('should handle initialization error', async () => {
      const listeners = {
        onConnectionStateChange: vi.fn(),
      };

      // ioをエラーを投げるようにモック
      (io as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('Socket creation failed');
      });

      await expect(socketClient.initializeSocketClient('http://localhost:3002', listeners))
        .rejects.toThrow('Socket creation failed');
      expect(listeners.onConnectionStateChange).toHaveBeenCalledWith('error');
    });
  });

  describe('Event Listeners Setup', () => {
    beforeEach(() => {
      socketClient.initializeSocketClient('http://test.server');
    });

    it('should set up all room event listeners', () => {
      const eventNames = [
        'room:created', 'room:joined', 'room:left', 'room:list',
        'room:updated', 'room:userJoined', 'room:userLeft'
      ];

      eventNames.forEach(eventName => {
        expect(mockSocket.on).toHaveBeenCalledWith(eventName, expect.any(Function));
      });
    });

    it('should set up all quiz event listeners', () => {
      const eventNames = [
        'quiz:added', 'quiz:removed', 'quiz:started',
        'quiz:answered', 'quiz:judged', 'quiz:ended'
      ];

      eventNames.forEach(eventName => {
        expect(mockSocket.on).toHaveBeenCalledWith(eventName, expect.any(Function));
      });
    });

    it('should set up host and error event listeners', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('host:transferred', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should call listener callbacks when events are triggered', () => {
      // Clear all mocks to reset the mock socket
      vi.clearAllMocks();
      
      const listeners = {
        onRoomCreated: vi.fn(),
        onRoomJoined: vi.fn(),
        onRoomLeft: vi.fn(),
        onRoomList: vi.fn(),
        onRoomUpdated: vi.fn(),
        onUserJoined: vi.fn(),
        onUserLeft: vi.fn(),
        onHostTransferred: vi.fn(),
        onQuizAdded: vi.fn(),
        onQuizRemoved: vi.fn(),
        onQuizStarted: vi.fn(),
        onQuizAnswered: vi.fn(),
        onQuizJudged: vi.fn(),
        onQuizEnded: vi.fn(),
        onError: vi.fn(),
      };

      // Get a fresh mock socket
      mockSocket = io();
      socketClient.initializeSocketClient('http://test.server', listeners);

      // Test room:created event
      const roomCreatedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'room:created')?.[1];
      const mockRoom: Room = {
        id: 'room1',
        name: 'Test Room',
        hostId: 'host1',
        users: [{ id: 'host1', name: 'Host', isHost: true }],
        isPublic: true,
        maxPlayers: 8,
        quizzes: [],
        createdAt: Date.now(),
      };
      roomCreatedHandler?.({ room: mockRoom });
      expect(listeners.onRoomCreated).toHaveBeenCalledWith({ room: mockRoom });

      // Test room:joined event
      const roomJoinedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'room:joined')?.[1];
      const mockUser: User = { id: 'user1', name: 'User', isHost: false };
      roomJoinedHandler?.({ room: mockRoom, user: mockUser });
      expect(listeners.onRoomJoined).toHaveBeenCalledWith({ room: mockRoom, user: mockUser });

      // Test room:left event
      const roomLeftHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'room:left')?.[1];
      roomLeftHandler?.();
      expect(listeners.onRoomLeft).toHaveBeenCalled();

      // Test room:list event
      const roomListHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'room:list')?.[1];
      roomListHandler?.({ rooms: [mockRoom] });
      expect(listeners.onRoomList).toHaveBeenCalledWith({ rooms: [mockRoom] });

      // Test room:updated event
      const roomUpdatedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'room:updated')?.[1];
      roomUpdatedHandler?.({ room: mockRoom });
      expect(listeners.onRoomUpdated).toHaveBeenCalledWith({ room: mockRoom });

      // Test room:userJoined event
      const userJoinedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'room:userJoined')?.[1];
      userJoinedHandler?.({ user: mockUser });
      expect(listeners.onUserJoined).toHaveBeenCalledWith({ user: mockUser });

      // Test room:userLeft event
      const userLeftHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'room:userLeft')?.[1];
      userLeftHandler?.({ userId: 'user1' });
      expect(listeners.onUserLeft).toHaveBeenCalledWith({ userId: 'user1' });

      // Test host:transferred event
      const hostTransferredHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'host:transferred')?.[1];
      hostTransferredHandler?.({ newHostId: 'user2' });
      expect(listeners.onHostTransferred).toHaveBeenCalledWith({ newHostId: 'user2' });

      // Test quiz events
      const mockQuiz: Quiz = { id: 'quiz1', type: 'text', question: 'Q?', answer: 'A' };
      
      const quizAddedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'quiz:added')?.[1];
      quizAddedHandler?.({ quiz: mockQuiz });
      expect(listeners.onQuizAdded).toHaveBeenCalledWith({ quiz: mockQuiz });

      const quizRemovedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'quiz:removed')?.[1];
      quizRemovedHandler?.({ quizId: 'quiz1' });
      expect(listeners.onQuizRemoved).toHaveBeenCalledWith({ quizId: 'quiz1' });

      const quizStartedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'quiz:started')?.[1];
      quizStartedHandler?.({ quiz: mockQuiz, timeLimit: 60 });
      expect(listeners.onQuizStarted).toHaveBeenCalledWith({ quiz: mockQuiz, timeLimit: 60 });

      const quizAnsweredHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'quiz:answered')?.[1];
      quizAnsweredHandler?.({ userId: 'user1', answer: 'A' });
      expect(listeners.onQuizAnswered).toHaveBeenCalledWith({ userId: 'user1', answer: 'A' });

      const quizJudgedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'quiz:judged')?.[1];
      quizJudgedHandler?.({ userId: 'user1', isCorrect: true, score: 100 });
      expect(listeners.onQuizJudged).toHaveBeenCalledWith({ userId: 'user1', isCorrect: true, score: 100 });

      const quizEndedHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'quiz:ended')?.[1];
      quizEndedHandler?.({ results: [{ userId: 'user1', score: 100 }] });
      expect(listeners.onQuizEnded).toHaveBeenCalledWith({ results: [{ userId: 'user1', score: 100 }] });

      // Test error event
      const errorHandler = mockSocket.on.mock.calls.find((call: any[]) => call[0] === 'error')?.[1];
      errorHandler?.({ message: 'Test error' });
      expect(listeners.onError).toHaveBeenCalledWith({ message: 'Test error' });
    });
  });

  describe('API Functions', () => {
    beforeEach(() => {
      // API関数をテストする前に必ず初期化する
      socketClient.initializeSocketClient('http://test.server');
      mockSocket.connected = true;
    });

    it('createRoom should emit "room:create" event', () => {
      const name = 'Test Room';
      const isPublic = true;
      const maxPlayers = 8;
      const userName = 'Host';
      const userId = 'user-1';

      socketClient.createRoom(name, isPublic, maxPlayers, userName, userId);
      expect(mockSocket.emit).toHaveBeenCalledWith('room:create', {
        name,
        isPublic,
        maxPlayers,
        userName,
        userId,
      });
    });

    it('createRoom should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.createRoom('Test', true)).toThrow('Socket not connected');
    });

    it('joinRoom should emit "room:join" event', () => {
      const roomId = 'room-1';
      const userId = 'user-2';
      const userName = 'Player';

      socketClient.joinRoom(roomId, userId, userName);
      expect(mockSocket.emit).toHaveBeenCalledWith('room:join', {
        roomId,
        userId,
        userName,
      });
    });

    it('joinRoom should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.joinRoom('room1', 'user1', 'User')).toThrow('Socket not connected');
    });

    it('joinRoom should work with custom socket argument', () => {
      const customSocket = {
        connected: true,
        emit: vi.fn(),
      };
      socketClient.joinRoom('room1', 'user1', 'User', customSocket as any);
      expect(customSocket.emit).toHaveBeenCalledWith('room:join', {
        roomId: 'room1',
        userId: 'user1',
        userName: 'User',
      });
    });

    it('leaveRoom should emit "room:leave" event', () => {
      socketClient.leaveRoom();
      expect(mockSocket.emit).toHaveBeenCalledWith('room:leave');
    });

    it('leaveRoom should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.leaveRoom()).toThrow('Socket not connected');
    });

    it('requestRoomList should emit "room:list" event', () => {
      socketClient.requestRoomList();
      expect(mockSocket.emit).toHaveBeenCalledWith('room:list');
    });

    it('requestRoomList should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.requestRoomList()).toThrow('Socket not connected');
    });

    it('transferHost should emit "host:transfer" event', () => {
      const newHostId = 'user-3';
      socketClient.transferHost(newHostId);
      expect(mockSocket.emit).toHaveBeenCalledWith('host:transfer', { newHostId });
    });

    it('transferHost should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.transferHost('user1')).toThrow('Socket not connected');
    });

    it('updateRoom should emit "room:update" event', () => {
      const updates = { name: 'New Name', isPublic: false };
      socketClient.updateRoom(updates);
      expect(mockSocket.emit).toHaveBeenCalledWith('room:update', updates);
    });

    it('updateRoom should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.updateRoom({ name: 'New' })).toThrow('Socket not connected');
    });

    it('addQuiz should emit "quiz:add" event', () => {
      const quiz: Quiz = { id: 'q1', type: 'text', question: 'Q', answer: 'A' };
      socketClient.addQuiz(quiz);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:add', quiz);
    });

    it('addQuiz should throw error when not connected', () => {
      mockSocket.connected = false;
      const quiz: Quiz = { id: 'q1', type: 'text', question: 'Q', answer: 'A' };
      expect(() => socketClient.addQuiz(quiz)).toThrow('Socket not connected');
    });

    it('removeQuiz should emit "quiz:remove" event', () => {
      const quizId = 'q1';
      socketClient.removeQuiz(quizId);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:remove', { quizId });
    });

    it('removeQuiz should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.removeQuiz('q1')).toThrow('Socket not connected');
    });

    it('startQuiz should emit "quiz:start" event', () => {
      const quizId = 'q1';
      const timeLimit = 60;
      socketClient.startQuiz(quizId, timeLimit);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:start', { quizId, timeLimit });
    });

    it('startQuiz should emit without timeLimit', () => {
      const quizId = 'q1';
      socketClient.startQuiz(quizId);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:start', { quizId, timeLimit: undefined });
    });

    it('startQuiz should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.startQuiz('q1')).toThrow('Socket not connected');
    });

    it('submitAnswer should emit "quiz:answer" event', () => {
      const quizId = 'q1';
      const answer = 'My Answer';
      socketClient.submitAnswer(quizId, answer);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:answer', { quizId, answer });
    });

    it('submitAnswer should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.submitAnswer('q1', 'answer')).toThrow('Socket not connected');
    });

    it('judgeAnswer should emit "quiz:judge" event', () => {
      const userId = 'user1';
      const isCorrect = true;
      const score = 100;
      socketClient.judgeAnswer(userId, isCorrect, score);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:judge', { userId, isCorrect, score });
    });

    it('judgeAnswer should emit without score', () => {
      const userId = 'user1';
      const isCorrect = false;
      socketClient.judgeAnswer(userId, isCorrect);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:judge', { userId, isCorrect, score: undefined });
    });

    it('judgeAnswer should throw error when not connected', () => {
      mockSocket.connected = false;
      expect(() => socketClient.judgeAnswer('user1', true)).toThrow('Socket not connected');
    });
  });

  describe('Connection status', () => {
    it('isConnected should return true when socket is connected', () => {
      socketClient.initializeSocketClient('http://test.server');
      mockSocket.connected = true;
      expect(socketClient.isConnected()).toBe(true);
    });

    it('isConnected should return false when socket is not connected', () => {
      socketClient.initializeSocketClient('http://test.server');
      mockSocket.connected = false;
      expect(socketClient.isConnected()).toBe(false);
    });

    it('isConnected should return false when socket is null', () => {
      socketClient.disconnect();
      expect(socketClient.isConnected()).toBe(false);
    });

    it('disconnect should call socket.disconnect', () => {
      socketClient.initializeSocketClient('http://test.server');
      socketClient.disconnect();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('disconnect should handle null socket gracefully', () => {
      // First, initialize socket to ensure it's not null
      socketClient.initializeSocketClient('http://test.server');
      
      // Disconnect once
      socketClient.disconnect();
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
      
      // Clear the mock to reset call count
      mockSocket.disconnect.mockClear();
      
      // Disconnect again when socket is null - should not throw and should not call disconnect
      socketClient.disconnect();
      expect(mockSocket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('getSocket', () => {
    it('should return socket instance when initialized', () => {
      socketClient.initializeSocketClient('http://test.server');
      const socket = socketClient.getSocket();
      expect(socket).toBe(mockSocket);
    });

    it('should return null when not initialized', () => {
      socketClient.disconnect();
      const socket = socketClient.getSocket();
      expect(socket).toBeNull();
    });
  });
}); 

