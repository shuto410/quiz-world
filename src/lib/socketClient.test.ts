import { describe, test, expect, vi, afterEach } from 'vitest';
import {
  getSocket,
  isConnected,
  disconnect,
  type ConnectionState,
  type EventListeners,
} from './socketClient';

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
    disconnect();
  });

  describe('getSocket', () => {
    test('should return null when not connected', () => {
      expect(getSocket()).toBeNull();
    });
  });

  describe('isConnected', () => {
    test('should return false when not connected', () => {
      expect(isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    test('should handle disconnect when not connected', () => {
      expect(() => disconnect()).not.toThrow();
    });
  });

  describe('Connection State Types', () => {
    test('should have correct connection state types', () => {
      const states: ConnectionState[] = ['disconnected', 'connecting', 'connected', 'error'];
      expect(states).toHaveLength(4);
      expect(states).toContain('disconnected');
      expect(states).toContain('connecting');
      expect(states).toContain('connected');
      expect(states).toContain('error');
    });
  });

  describe('Event Listeners Types', () => {
    test('should have correct event listener types', () => {
      const listeners: EventListeners = {
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
}); 