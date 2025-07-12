/**
 * Socket.io client connection management for Quiz World application
 * - Handles connection to Socket.io server
 * - Manages event listeners and connection state
 * - Provides type-safe event handling
 */

import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/socket';
import type { Room, User, Quiz } from '../types';

/**
 * Socket.io client instance
 */
let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Event listeners for different events
 */
export type EventListeners = {
  onRoomCreated?: (data: { room: Room }) => void;
  onRoomJoined?: (data: { room: Room; user: User }) => void;
  onRoomLeft?: () => void;
  onRoomList?: (data: { rooms: Room[] }) => void;
  onRoomUpdated?: (data: { room: Room }) => void;
  onUserJoined?: (data: { user: User }) => void;
  onUserLeft?: (data: { userId: string }) => void;
  onHostTransferred?: (data: { newHostId: string }) => void;
  onQuizAdded?: (data: { quiz: Quiz }) => void;
  onQuizRemoved?: (data: { quizId: string }) => void;
  onQuizStarted?: (data: { quiz: Quiz; timeLimit: number }) => void;
  onQuizAnswered?: (data: { userId: string; answer: string }) => void;
  onQuizJudged?: (data: { userId: string; isCorrect: boolean; score: number }) => void;
  onQuizEnded?: (data: { results: Array<{ userId: string; score: number }> }) => void;
  onError?: (data: { message: string }) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
};

/**
 * Initialize Socket.io client connection
 * @param serverUrl - Socket.io server URL
 * @param listeners - Event listeners
 * @returns Promise that resolves when connected
 */
export function initializeSocketClient(
  serverUrl: string,
  listeners: EventListeners = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // If socket already exists and is connected, just add new listeners
      if (socket && socket.connected) {
        console.log('Socket already connected, adding new listeners');
        setupEventListeners(socket, listeners);
        listeners.onConnectionStateChange?.('connected');
        resolve();
        return;
      }

      // If socket exists but is disconnected, disconnect and cleanup first
      if (socket) {
        console.log('Cleaning up existing disconnected socket');
        socket.disconnect();
        socket.removeAllListeners();
        socket = null;
      }

      // Create socket connection
      socket = io(serverUrl, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Set up event listeners
      setupEventListeners(socket, listeners);

      // Handle connection events
      socket.on('connect', () => {
        console.log('Connected to server');
        listeners.onConnectionStateChange?.('connected');
        resolve();
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from server');
        listeners.onConnectionStateChange?.('disconnected');
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        listeners.onConnectionStateChange?.('error');
        reject(error);
      });

      // Start connection
      listeners.onConnectionStateChange?.('connecting');
      socket.connect();
    } catch (error) {
      console.error('Failed to initialize socket client:', error);
      listeners.onConnectionStateChange?.('error');
      reject(error);
    }
  });
}

/**
 * Set up event listeners for the socket
 * @param socket - Socket instance
 * @param listeners - Event listeners
 */
function setupEventListeners(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  listeners: EventListeners
) {
  // Room management events
  socket.on('room:created', (data) => {
    console.log('Room created:', data.room.id, 'Host:', data.room.users[0]?.name, 'isHost:', data.room.users[0]?.isHost);
    listeners.onRoomCreated?.(data);
  });

  socket.on('room:joined', (data) => {
    console.log('Joined room:', data.room.id, 'User:', data.user?.name, 'isHost:', data.user?.isHost);
    listeners.onRoomJoined?.(data);
  });

  socket.on('room:left', () => {
    console.log('Left room');
    listeners.onRoomLeft?.();
  });

  socket.on('room:list', (data) => {
    console.log('Room list received:', data.rooms.length, 'rooms');
    listeners.onRoomList?.(data);
  });

  socket.on('room:updated', (data) => {
    console.log('Room updated:', data.room.id);
    listeners.onRoomUpdated?.(data);
  });

  socket.on('room:userJoined', (data) => {
    console.log('User joined:', data.user.name);
    listeners.onUserJoined?.(data);
  });

  socket.on('room:userLeft', (data) => {
    console.log('User left:', data.userId);
    listeners.onUserLeft?.(data);
  });

  // Host management events
  socket.on('host:transferred', (data) => {
    console.log('Host transferred to:', data.newHostId);
    listeners.onHostTransferred?.(data);
  });

  // Quiz management events
  socket.on('quiz:added', (data) => {
    console.log('Quiz added:', data.quiz.id);
    listeners.onQuizAdded?.(data);
  });

  socket.on('quiz:removed', (data) => {
    console.log('Quiz removed:', data.quizId);
    listeners.onQuizRemoved?.(data);
  });

  socket.on('quiz:started', (data) => {
    console.log('Quiz started:', data.quiz.id);
    listeners.onQuizStarted?.(data);
  });

  socket.on('quiz:answered', (data) => {
    console.log('Quiz answered by:', data.userId);
    listeners.onQuizAnswered?.(data);
  });

  socket.on('quiz:judged', (data) => {
    console.log('Quiz judged for:', data.userId, 'Score:', data.score);
    listeners.onQuizJudged?.(data);
  });

  socket.on('quiz:ended', (data) => {
    console.log('Quiz ended, results:', data.results);
    listeners.onQuizEnded?.(data);
  });

  // Error events
  socket.on('error', (data) => {
    console.error('Server error:', data.message);
    listeners.onError?.(data);
  });
}

/**
 * Get the current socket instance
 * @returns Socket instance or null if not connected
 */
export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
  return socket;
}

/**
 * Check if socket is connected
 * @returns True if connected, false otherwise
 */
export function isConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Disconnect from the server
 */
export function disconnect(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Create a new room
 * @param name - Room name
 * @param isPublic - Whether the room is public
 * @param maxPlayers - Maximum number of players
 * @param userName - User name (host)
 * @param userId - User ID (host)
 * @param isDemo - Whether this is a demo room with mock data
 */
export function createRoom(name: string, isPublic: boolean, maxPlayers: number = 8, userName?: string, userId?: string, isDemo: boolean = false): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  console.log('Creating room with:', { name, isPublic, maxPlayers, userName, userId, isDemo });
  currentSocket.emit('room:create', { name, isPublic, maxPlayers, userName, userId, isDemo });
}

/**
 * Join an existing room
 * @param roomId - Room ID to join
 * @param userId - User ID
 * @param userName - User name
 * @param socketArg - Optional socket instance for testing
 */
export function joinRoom(
  roomId: string,
  userId: string,
  userName: string,
  socketArg?: import('socket.io-client').Socket<ServerToClientEvents, ClientToServerEvents> | null
): void {
  const socketToUse = socketArg ?? getSocket();
  if (!socketToUse?.connected) {
    throw new Error('Socket not connected');
  }
  
  console.log('Socket client joining room:', { roomId, userId, userName });
  socketToUse.emit('room:join', { roomId, userId, userName });
}

/**
 * Leave the current room
 */
export function leaveRoom(): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('room:leave');
}

/**
 * Request list of public rooms
 */
export function requestRoomList(): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('room:list');
}

/**
 * Transfer host role to another user
 * @param newHostId - New host user ID
 */
export function transferHost(newHostId: string): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('host:transfer', { newHostId });
}

/**
 * Update room properties
 * @param updates - Properties to update
 */
export function updateRoom(updates: { name?: string; isPublic?: boolean }): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('room:update', updates);
}

/**
 * Add a quiz to the room
 * @param quiz - Quiz to add
 */
export function addQuiz(quiz: Quiz): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('quiz:add', quiz);
}

/**
 * Remove a quiz from the room
 * @param quizId - Quiz ID to remove
 */
export function removeQuiz(quizId: string): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('quiz:remove', { quizId });
}

/**
 * Start a quiz
 * @param quizId - Quiz ID to start
 * @param timeLimit - Time limit in seconds
 */
export function startQuiz(quizId: string, timeLimit?: number): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('quiz:start', { quizId, timeLimit });
}

/**
 * Submit an answer to a quiz
 * @param quizId - Quiz ID
 * @param answer - User's answer
 */
export function submitAnswer(quizId: string, answer: string): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('quiz:answer', { quizId, answer });
}

/**
 * Judge a user's answer (host only)
 * @param userId - User ID
 * @param isCorrect - Whether the answer is correct
 * @param score - Score to award
 */
export function judgeAnswer(userId: string, isCorrect: boolean, score?: number): void {
  const currentSocket = getSocket();
  if (!currentSocket?.connected) {
    throw new Error('Socket not connected');
  }
  currentSocket.emit('quiz:judge', { userId, isCorrect, score });
} 