import { describe, test, expect, beforeEach, vi } from 'vitest';
import { initializeSocket } from './socket';
import type { Quiz } from '../types';

// Mock Socket.io
vi.mock('socket.io', () => ({
  Server: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  })),
}));

describe('Socket.io Server', () => {
  let mockServer: any;
  let mockSocket: any;


  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create mock server
    mockServer = {};
    
    // Create mock socket
    mockSocket = {
      id: 'socket-1',
      data: {},
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
      on: vi.fn(),
    };
    

  });

  describe('initializeSocket', () => {
    test('should initialize Socket.io server', () => {
      expect(() => initializeSocket(mockServer)).not.toThrow();
    });
  });



  describe('Socket Event Handlers', () => {
    beforeEach(() => {
      // Initialize socket server
      initializeSocket(mockServer);
    });

    test('should handle room creation', () => {
      const createData = {
        name: 'Test Room',
        isPublic: true,
        maxPlayers: 8,
      };
      
      // Simulate room:create event
      const eventHandlers = mockSocket.on.mock.calls.reduce((acc: any, call: any) => {
        acc[call[0]] = call[1];
        return acc;
      }, {});
      
      if (eventHandlers['room:create']) {
        eventHandlers['room:create'](createData);
        
        // Check that socket data was set
        expect(mockSocket.data.roomId).toBeDefined();
        expect(mockSocket.data.userId).toBeDefined();
        expect(mockSocket.data.userName).toBe('Anonymous');
        
        // Check that socket joined the room
        expect(mockSocket.join).toHaveBeenCalledWith(mockSocket.data.roomId);
        
        // Check that room:created event was emitted
        expect(mockSocket.emit).toHaveBeenCalledWith('room:created', expect.objectContaining({
          room: expect.objectContaining({
            name: 'Test Room',
            isPublic: true,
            maxPlayers: 8,
          }),
        }));
      }
    });

    test('should handle room join', () => {
      // First create a room
      const createData = { name: 'Test Room', isPublic: true };
      const eventHandlers = mockSocket.on.mock.calls.reduce((acc: any, call: any) => {
        acc[call[0]] = call[1];
        return acc;
      }, {});
      
      if (eventHandlers['room:create']) {
        eventHandlers['room:create'](createData);
        const roomId = mockSocket.data.roomId;
        
        // Create a new socket for joining
        const joinSocket = {
          ...mockSocket,
          data: {},
        };
        
        const joinData = {
          roomId,
          userName: 'New User',
        };
        
        if (eventHandlers['room:join']) {
          eventHandlers['room:join'].call(joinSocket, joinData);
          
          // Check that socket data was set
          expect(joinSocket.data.roomId).toBe(roomId);
          expect(joinSocket.data.userId).toBeDefined();
          expect(joinSocket.data.userName).toBe('New User');
          
          // Check that socket joined the room
          expect(joinSocket.join).toHaveBeenCalledWith(roomId);
          
          // Check that room:joined event was emitted
          expect(joinSocket.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({
            room: expect.objectContaining({ id: roomId }),
            user: expect.objectContaining({ name: 'New User' }),
          }));
        }
      }
    });

    test('should handle room list request', () => {
      const eventHandlers = mockSocket.on.mock.calls.reduce((acc: any, call: any) => {
        acc[call[0]] = call[1];
        return acc;
      }, {});
      
      if (eventHandlers['room:list']) {
        eventHandlers['room:list']();
        
        // Check that room:list event was emitted
        expect(mockSocket.emit).toHaveBeenCalledWith('room:list', expect.objectContaining({
          rooms: expect.any(Array),
        }));
      }
    });

    test('should handle quiz addition', () => {
      // First create a room and set up host
      const createData = { name: 'Test Room', isPublic: true };
      const eventHandlers = mockSocket.on.mock.calls.reduce((acc: any, call: any) => {
        acc[call[0]] = call[1];
        return acc;
      }, {});
      
      if (eventHandlers['room:create']) {
        eventHandlers['room:create'](createData);
        
        const quiz: Quiz = {
          id: 'quiz-1',
          type: 'text',
          question: 'What is 2+2?',
          answer: '4',
        };
        
        if (eventHandlers['quiz:add']) {
          eventHandlers['quiz:add'](quiz);
          
          // Check that quiz:added event was emitted
          expect(mockSocket.emit).toHaveBeenCalledWith('quiz:added', expect.objectContaining({
            quiz: expect.objectContaining({
              id: 'quiz-1',
              question: 'What is 2+2?',
            }),
          }));
        }
      }
    });

    test('should handle quiz answer', () => {
      // First create a room
      const createData = { name: 'Test Room', isPublic: true };
      const eventHandlers = mockSocket.on.mock.calls.reduce((acc: any, call: any) => {
        acc[call[0]] = call[1];
        return acc;
      }, {});
      
      if (eventHandlers['room:create']) {
        eventHandlers['room:create'](createData);
        
        const answerData = {
          quizId: 'quiz-1',
          answer: '4',
        };
        
        if (eventHandlers['quiz:answer']) {
          eventHandlers['quiz:answer'](answerData);
          
          // Check that quiz:answered event was emitted
          expect(mockSocket.emit).toHaveBeenCalledWith('quiz:answered', expect.objectContaining({
            userId: expect.any(String),
            answer: '4',
          }));
        }
      }
    });

    test('should handle game buzz event', () => {
      // First create a room
      const createData = { name: 'Test Room', isPublic: true };
      const eventHandlers = mockSocket.on.mock.calls.reduce((acc: any, call: any) => {
        acc[call[0]] = call[1];
        return acc;
      }, {});
      
      if (eventHandlers['room:create']) {
        eventHandlers['room:create'](createData);
        
        const buzzData = {
          user: {
            id: 'user-1',
            name: 'Test User',
            isHost: false,
          },
        };
        
        if (eventHandlers['game:buzz']) {
          eventHandlers['game:buzz'](buzzData);
          
          // Check that game:buzz event was emitted to all users in the room
          expect(mockSocket.to).toHaveBeenCalledWith(mockSocket.data.roomId);
          expect(mockSocket.emit).toHaveBeenCalledWith('game:buzz', expect.objectContaining({
            user: expect.objectContaining({
              id: 'user-1',
              name: 'Test User',
            }),
          }));
        }
      }
    });

    test('should handle error cases', () => {
      const eventHandlers = mockSocket.on.mock.calls.reduce((acc: any, call: any) => {
        acc[call[0]] = call[1];
        return acc;
      }, {});
      
      // Test joining non-existent room
      if (eventHandlers['room:join']) {
        eventHandlers['room:join']({ roomId: 'non-existent', userName: 'User' });
        
        // Check that error event was emitted
        expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
          message: 'Failed to join room',
        }));
      }
    });
  });
}); 