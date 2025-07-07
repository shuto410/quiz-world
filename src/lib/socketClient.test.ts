import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as socketClient from './socketClient';
import { io } from 'socket.io-client';
import type { Quiz } from '@/types';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    it('leaveRoom should emit "room:leave" event', () => {
      socketClient.leaveRoom();
      expect(mockSocket.emit).toHaveBeenCalledWith('room:leave');
    });

    it('requestRoomList should emit "room:list" event', () => {
      socketClient.requestRoomList();
      expect(mockSocket.emit).toHaveBeenCalledWith('room:list');
    });

    it('transferHost should emit "host:transfer" event', () => {
      const newHostId = 'user-3';
      socketClient.transferHost(newHostId);
      expect(mockSocket.emit).toHaveBeenCalledWith('host:transfer', { newHostId });
    });

    it('addQuiz should emit "quiz:add" event', () => {
      const quiz: Quiz = { id: 'q1', type: 'text', question: 'Q', answer: 'A' };
      socketClient.addQuiz(quiz);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:add', quiz);
    });

    it('removeQuiz should emit "quiz:remove" event', () => {
      const quizId = 'q1';
      socketClient.removeQuiz(quizId);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:remove', { quizId });
    });

    it('startQuiz should emit "quiz:start" event', () => {
      const quizId = 'q1';
      const timeLimit = 60;
      socketClient.startQuiz(quizId, timeLimit);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:start', { quizId, timeLimit });
    });

    it('submitAnswer should emit "quiz:answer" event', () => {
      const quizId = 'q1';
      const answer = 'My Answer';
      socketClient.submitAnswer(quizId, answer);
      expect(mockSocket.emit).toHaveBeenCalledWith('quiz:answer', { quizId, answer });
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

    it('disconnect should call socket.disconnect', () => {
      socketClient.initializeSocketClient('http://test.server');
      socketClient.disconnect();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });
}); 

