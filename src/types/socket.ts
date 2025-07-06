/**
 * Socket.io event types for Quiz World application
 * - Client to Server events
 * - Server to Client events
 * - Room management events
 */

import type { Room, User, Quiz } from './index';

/**
 * Client to Server events
 */
export interface ClientToServerEvents {
  // Room management
  'room:create': (data: { name: string; isPublic: boolean; maxPlayers?: number }) => void;
  'room:join': (data: { roomId: string; userName: string }) => void;
  'room:leave': () => void;
  'room:list': () => void;
  
  // Host management
  'host:transfer': (data: { newHostId: string }) => void;
  'room:update': (data: { name?: string; isPublic?: boolean }) => void;
  
  // Quiz management
  'quiz:add': (data: Quiz) => void;
  'quiz:remove': (data: { quizId: string }) => void;
  'quiz:start': (data: { quizId: string; timeLimit?: number }) => void;
  'quiz:answer': (data: { quizId: string; answer: string }) => void;
  'quiz:judge': (data: { userId: string; isCorrect: boolean; score?: number }) => void;
}

/**
 * Server to Client events
 */
export interface ServerToClientEvents {
  // Room management
  'room:created': (data: { room: Room }) => void;
  'room:joined': (data: { room: Room; user: User }) => void;
  'room:left': () => void;
  'room:list': (data: { rooms: Room[] }) => void;
  'room:updated': (data: { room: Room }) => void;
  'room:userJoined': (data: { user: User }) => void;
  'room:userLeft': (data: { userId: string }) => void;
  
  // Host management
  'host:transferred': (data: { newHostId: string }) => void;
  
  // Quiz management
  'quiz:added': (data: { quiz: Quiz }) => void;
  'quiz:removed': (data: { quizId: string }) => void;
  'quiz:started': (data: { quiz: Quiz; timeLimit: number }) => void;
  'quiz:answered': (data: { userId: string; answer: string }) => void;
  'quiz:judged': (data: { userId: string; isCorrect: boolean; score: number }) => void;
  'quiz:ended': (data: { results: Array<{ userId: string; score: number }> }) => void;
  
  // Error events
  'error': (data: { message: string }) => void;
}

/**
 * Inter-server events (for future scaling)
 */
export interface InterServerEvents {
  ping: () => void;
}

/**
 * Socket data attached to each socket
 */
export interface SocketData {
  userId?: string;
  roomId?: string;
  userName?: string;
} 