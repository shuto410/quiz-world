import { describe, test, expect } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './socket';
import type { Room, User, Quiz } from './index';

describe('Socket.io Event Types', () => {
  test('ClientToServerEvents type usage', () => {
    const events: ClientToServerEvents = {
      'room:create': (data) => {
        expect(data.name).toBe('Test Room');
        expect(data.isPublic).toBe(true);
      },
      'room:join': (data) => {
        expect(data.roomId).toBe('room1');
        expect(data.userName).toBe('Alice');
      },
      'room:leave': () => {},
      'room:list': () => {},
      'host:transfer': (data) => {
        expect(data.newHostId).toBe('user2');
      },
      'room:update': (data) => {
        expect(data.name).toBe('Updated Room');
        expect(data.isPublic).toBe(false);
      },
      'quiz:add': (data) => {
        expect(data.type).toBe('text');
        expect(data.question).toBe('What is 2+2?');
      },
      'quiz:remove': (data) => {
        expect(data.quizId).toBe('quiz1');
      },
      'quiz:start': (data) => {
        expect(data.quizId).toBe('quiz1');
        expect(data.timeLimit).toBe(30);
      },
      'quiz:answer': (data) => {
        expect(data.quizId).toBe('quiz1');
        expect(data.answer).toBe('4');
      },
      'quiz:judge': (data) => {
        expect(data.userId).toBe('user1');
        expect(data.isCorrect).toBe(true);
        expect(data.score).toBe(10);
      },
    };

    // Test room:create event
    events['room:create']({ name: 'Test Room', isPublic: true });
    
    // Test room:join event
    events['room:join']({ roomId: 'room1', userName: 'Alice' });
    
    // Test host:transfer event
    events['host:transfer']({ newHostId: 'user2' });
    
    // Test room:update event
    events['room:update']({ name: 'Updated Room', isPublic: false });
    
    // Test quiz:add event
    const quiz: Quiz = {
      id: 'quiz1',
      type: 'text',
      question: 'What is 2+2?',
      answer: '4',
    };
    events['quiz:add'](quiz);
    
    // Test quiz:remove event
    events['quiz:remove']({ quizId: 'quiz1' });
    
    // Test quiz:start event
    events['quiz:start']({ quizId: 'quiz1', timeLimit: 30 });
    
    // Test quiz:answer event
    events['quiz:answer']({ quizId: 'quiz1', answer: '4' });
    
    // Test quiz:judge event
    events['quiz:judge']({ userId: 'user1', isCorrect: true, score: 10 });
  });

  test('ServerToClientEvents type usage', () => {
    const events: ServerToClientEvents = {
      'room:created': (data) => {
        expect(data.room.id).toBe('room1');
        expect(data.room.name).toBe('Test Room');
      },
      'room:joined': (data) => {
        expect(data.room.id).toBe('room1');
        expect(data.user.id).toBe('user1');
      },
      'room:left': () => {},
      'room:list': (data) => {
        expect(data.rooms).toHaveLength(1);
      },
      'room:updated': (data) => {
        expect(data.room.name).toBe('Updated Room');
      },
      'room:userJoined': (data) => {
        expect(data.user.name).toBe('Alice');
      },
      'room:userLeft': (data) => {
        expect(data.userId).toBe('user1');
      },
      'host:transferred': (data) => {
        expect(data.newHostId).toBe('user2');
      },
      'quiz:added': (data) => {
        expect(data.quiz.id).toBe('quiz1');
      },
      'quiz:removed': (data) => {
        expect(data.quizId).toBe('quiz1');
      },
      'quiz:started': (data) => {
        expect(data.quiz.id).toBe('quiz1');
        expect(data.timeLimit).toBe(30);
      },
      'quiz:answered': (data) => {
        expect(data.userId).toBe('user1');
        expect(data.answer).toBe('4');
      },
      'quiz:judged': (data) => {
        expect(data.userId).toBe('user1');
        expect(data.isCorrect).toBe(true);
        expect(data.score).toBe(10);
      },
      'quiz:ended': (data) => {
        expect(data.results).toHaveLength(1);
        expect(data.results[0].userId).toBe('user1');
        expect(data.results[0].score).toBe(10);
      },
      'error': (data) => {
        expect(data.message).toBe('Error message');
      },
    };

    // Test room:created event
    const room: Room = {
      id: 'room1',
      name: 'Test Room',
      isPublic: true,
      users: [],
      quizzes: [],
      hostId: 'user1',
      maxPlayers: 8,
    };
    events['room:created']({ room });
    
    // Test room:joined event
    const user: User = {
      id: 'user1',
      name: 'Alice',
      isHost: true,
    };
    events['room:joined']({ room, user });
    
    // Test room:list event
    events['room:list']({ rooms: [room] });
    
    // Test room:updated event
    const updatedRoom: Room = { ...room, name: 'Updated Room' };
    events['room:updated']({ room: updatedRoom });
    
    // Test room:userJoined event
    events['room:userJoined']({ user });
    
    // Test room:userLeft event
    events['room:userLeft']({ userId: 'user1' });
    
    // Test host:transferred event
    events['host:transferred']({ newHostId: 'user2' });
    
    // Test quiz:added event
    const quiz: Quiz = {
      id: 'quiz1',
      type: 'text',
      question: 'What is 2+2?',
      answer: '4',
    };
    events['quiz:added']({ quiz });
    
    // Test quiz:removed event
    events['quiz:removed']({ quizId: 'quiz1' });
    
    // Test quiz:started event
    events['quiz:started']({ quiz, timeLimit: 30 });
    
    // Test quiz:answered event
    events['quiz:answered']({ userId: 'user1', answer: '4' });
    
    // Test quiz:judged event
    events['quiz:judged']({ userId: 'user1', isCorrect: true, score: 10 });
    
    // Test quiz:ended event
    events['quiz:ended']({ results: [{ userId: 'user1', score: 10 }] });
    
    // Test error event
    events['error']({ message: 'Error message' });
  });

  test('SocketData type usage', () => {
    const socketData: SocketData = {
      userId: 'user1',
      roomId: 'room1',
      userName: 'Alice',
    };
    
    expect(socketData.userId).toBe('user1');
    expect(socketData.roomId).toBe('room1');
    expect(socketData.userName).toBe('Alice');
  });
}); 