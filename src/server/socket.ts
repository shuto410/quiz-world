/**
 * Socket.io server implementation for Quiz World application
 * - Handles real-time communication between clients
 * - Manages room events, user connections, and quiz interactions
 */

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '../types/socket';
import type { User, Quiz } from '../types';
import {
  createRoom,
  createRoomWithHost,
  joinRoom,
  leaveRoom,
  transferHost,
  updateRoom,
  getPublicRooms,
  getRoom,
  getUser,
} from '../lib/roomManager';

/**
 * Socket.io server instance
 */
let io: SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Initialize Socket.io server
 * @param server - HTTP server instance
 */
export function initializeSocket(server: HTTPServer) {
  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.vercel.app'] 
        : ['http://localhost:3000', 'http://localhost:3002'],
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', handleConnection);
}

/**
 * Handle new socket connection
 * @param socket - Socket instance
 */
function handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
  console.log('User connected:', socket.id);

  // Room management events
  socket.on('room:create', (data: { name: string; isPublic: boolean; maxPlayers?: number; userName?: string; userId?: string }) => handleRoomCreate(socket, data));
  socket.on('room:join', (data: { roomId: string; userId: string; userName: string }) => handleRoomJoin(socket, data));
  socket.on('room:leave', () => handleRoomLeave(socket));
  socket.on('room:list', () => handleRoomList(socket));
  
  // Host management events
  socket.on('host:transfer', (data: { newHostId: string }) => handleHostTransfer(socket, data));
  socket.on('room:update', (data: { name?: string; isPublic?: boolean }) => handleRoomUpdate(socket, data));
  
  // Quiz management events
  socket.on('quiz:add', (data: Quiz) => handleQuizAdd(socket, data));
  socket.on('quiz:remove', (data: { quizId: string }) => handleQuizRemove(socket, data));
  socket.on('quiz:start', (data: { quizId: string; timeLimit?: number }) => handleQuizStart(socket, data));
  socket.on('quiz:answer', (data: { quizId: string; answer: string }) => handleQuizAnswer(socket, data));
  socket.on('quiz:judge', (data: { userId: string; isCorrect: boolean; score?: number }) => handleQuizJudge(socket, data));

  // Handle disconnection
  socket.on('disconnect', () => handleDisconnect(socket));
}

/**
 * Handle room creation
 * @param socket - Socket instance
 * @param data - Room creation data
 */
function handleRoomCreate(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: { name: string; isPublic: boolean; maxPlayers?: number; userName?: string; userId?: string }) {
  try {
    console.log('Room creation request:', data);
    
    const userName = data.userName || socket.data.userName || 'Anonymous';
    const userId = data.userId;
    
    console.log('Creating room with:', { name: data.name, isPublic: data.isPublic, maxPlayers: data.maxPlayers, userName, userId });
    
    // Create room with the provided user ID if available
    console.log('About to create room with userId:', userId);
    const room = userId 
      ? createRoomWithHost(data.name, data.isPublic, data.maxPlayers, userName, userId)
      : createRoom(data.name, data.isPublic, data.maxPlayers, userName);
    console.log('Room creation method used:', userId ? 'createRoomWithHost' : 'createRoom');
    
    console.log('Room created successfully:', { roomId: room.id, hostId: room.hostId, hostName: room.users[0].name });
    
    // Set socket data
    socket.data.userId = room.users[0].id;
    socket.data.roomId = room.id;
    socket.data.userName = userName;
    
    // Join socket to room
    socket.join(room.id);
    
    // Notify client of room creation
    socket.emit('room:created', { room });
    
    // Notify client that they are joined as host (this is part of room creation)
    console.log(`Sending room:joined event to host ${userName} (${room.users[0].id})`);
    socket.emit('room:joined', { room, user: room.users[0] });
    
    console.log(`Room created: ${room.id} by ${userName}`);
  } catch (error) {
    console.error('Error creating room:', error);
    socket.emit('error', { message: `Failed to create room: ${error instanceof Error ? error.message : 'Unknown error'}` });
  }
}

/**
 * Handle room join
 * @param socket - Socket instance
 * @param data - Room join data
 */
function handleRoomJoin(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: { roomId: string; userId: string; userName: string }) {
  try {
    console.log('Join room request:', { roomId: data.roomId, userName: data.userName, userId: data.userId });
    
    // Check if user is already in the room
    const existingRoom = getRoom(data.roomId);
    let existingUser: User | null = null;
    
    if (existingRoom && data.userId) {
      existingUser = existingRoom.users.find(user => user.id === data.userId) || null;
      if (existingUser) {
        console.log(`User ${data.userName} (${data.userId}) is already in room, reconnecting`);
        
        // Set socket data
        socket.data.userId = existingUser.id;
        socket.data.roomId = existingRoom.id;
        socket.data.userName = data.userName;
        
        // Join socket to room
        socket.join(existingRoom.id);
        
        // Notify client
        socket.emit('room:joined', { room: existingRoom, user: existingUser });
        
        console.log(`User ${data.userName} reconnected to room: ${existingRoom.id}`);
        return;
      }
    }
    
    // Check if this is a host user trying to join their own room (from room creation)
    if (existingRoom && existingRoom.hostId === data.userId) {
      console.log(`Host user ${data.userName} (${data.userId}) is trying to join their own room, allowing reconnection`);
      
      // Find the host user in the room
      const hostUser = existingRoom.users.find(user => user.id === data.userId);
      if (hostUser) {
        // Set socket data
        socket.data.userId = hostUser.id;
        socket.data.roomId = existingRoom.id;
        socket.data.userName = data.userName;
        
        // Join socket to room
        socket.join(existingRoom.id);
        
        // Notify client
        socket.emit('room:joined', { room: existingRoom, user: hostUser });
        
        console.log(`Host user ${data.userName} reconnected to their room: ${existingRoom.id}`);
        return;
      }
    }
    
    const result = joinRoom(data.roomId, data.userName, data.userId);
    
    if (!result) {
      socket.emit('error', { message: 'Failed to join room' });
      return;
    }
    
    const { room, user } = result;
    
    console.log('User joined successfully:', { userId: user.id, userName: user.name, roomId: room.id });
    console.log(`This was a NEW join (not reconnection) for user ${data.userName}`);
    
    // Set socket data
    socket.data.userId = user.id;
    socket.data.roomId = room.id;
    socket.data.userName = data.userName;
    
    // Join socket to room
    socket.join(room.id);
    
    // Notify client
    socket.emit('room:joined', { room, user });
    
    // Notify other users in the room (only for new users, not reconnections)
    if (!existingUser) {
      socket.to(room.id).emit('room:userJoined', { user });
    }
    
    console.log(`User ${data.userName} joined room: ${room.id}`);
  } catch (error) {
    console.error('Error joining room:', error);
    socket.emit('error', { message: 'Failed to join room' });
  }
}

/**
 * Handle room leave
 * @param socket - Socket instance
 */
function handleRoomLeave(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
  try {
    const { roomId, userId } = socket.data;
    
    if (!roomId || !userId) {
      // User is not in a room - this is not an error, just ignore silently
      // This can happen when leaveRoom is called multiple times
      console.log('User tried to leave room but was not in any room');
      socket.emit('room:left'); // Still send confirmation to client
      return;
    }
    
    const updatedRoom = leaveRoom(roomId, userId);
    
    // Leave socket room
    socket.leave(roomId);
    
    // Clear socket data
    socket.data.roomId = undefined;
    socket.data.userId = undefined;
    
    // Notify client
    socket.emit('room:left');
    
    // Notify other users if room still exists
    if (updatedRoom) {
      socket.to(roomId).emit('room:userLeft', { userId });
    }
    
    console.log(`User ${socket.data.userName} left room: ${roomId}`);
  } catch {
    socket.emit('error', { message: 'Failed to leave room' });
  }
}

/**
 * Handle room list request
 * @param socket - Socket instance
 */
function handleRoomList(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
  try {
    const publicRooms = getPublicRooms();
    socket.emit('room:list', { rooms: publicRooms });
  } catch {
    socket.emit('error', { message: 'Failed to get room list' });
  }
}

/**
 * Handle host transfer
 * @param socket - Socket instance
 * @param data - Host transfer data
 */
function handleHostTransfer(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: { newHostId: string }) {
  try {
    const { roomId } = socket.data;
    
    if (!roomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const user = getUser(roomId, socket.data.userId!);
    if (!user || !user.isHost) {
      socket.emit('error', { message: 'Only host can transfer host role' });
      return;
    }
    
    const updatedRoom = transferHost(roomId, data.newHostId);
    
    if (!updatedRoom) {
      socket.emit('error', { message: 'Failed to transfer host role' });
      return;
    }
    
    // Notify all users in the room
    io.to(roomId).emit('host:transferred', { newHostId: data.newHostId });
    
    console.log(`Host transferred to ${data.newHostId} in room: ${roomId}`);
  } catch {
    socket.emit('error', { message: 'Failed to transfer host role' });
  }
}

/**
 * Handle room update
 * @param socket - Socket instance
 * @param data - Room update data
 */
function handleRoomUpdate(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: { name?: string; isPublic?: boolean }) {
  try {
    const { roomId } = socket.data;
    
    if (!roomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const user = getUser(roomId, socket.data.userId!);
    if (!user || !user.isHost) {
      socket.emit('error', { message: 'Only host can update room' });
      return;
    }
    
    const updatedRoom = updateRoom(roomId, data);
    
    if (!updatedRoom) {
      socket.emit('error', { message: 'Failed to update room' });
      return;
    }
    
    // Notify all users in the room
    io.to(roomId).emit('room:updated', { room: updatedRoom });
    
    console.log(`Room updated: ${roomId}`);
  } catch {
    socket.emit('error', { message: 'Failed to update room' });
  }
}

/**
 * Handle quiz addition
 * @param socket - Socket instance
 * @param data - Quiz data
 */
function handleQuizAdd(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: Quiz) {
  try {
    const { roomId } = socket.data;
    
    if (!roomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const user = getUser(roomId, socket.data.userId!);
    if (!user || !user.isHost) {
      socket.emit('error', { message: 'Only host can add quizzes' });
      return;
    }
    
    room.quizzes.push(data);
    
    // Notify all users in the room
    io.to(roomId).emit('quiz:added', { quiz: data });
    
    console.log(`Quiz added to room: ${roomId}`);
  } catch {
    socket.emit('error', { message: 'Failed to add quiz' });
  }
}

/**
 * Handle quiz removal
 * @param socket - Socket instance
 * @param data - Quiz removal data
 */
function handleQuizRemove(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: { quizId: string }) {
  try {
    const { roomId } = socket.data;
    
    if (!roomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const user = getUser(roomId, socket.data.userId!);
    if (!user || !user.isHost) {
      socket.emit('error', { message: 'Only host can remove quizzes' });
      return;
    }
    
    const quizIndex = room.quizzes.findIndex(quiz => quiz.id === data.quizId);
    if (quizIndex === -1) {
      socket.emit('error', { message: 'Quiz not found' });
      return;
    }
    
    room.quizzes.splice(quizIndex, 1);
    
    // Notify all users in the room
    io.to(roomId).emit('quiz:removed', { quizId: data.quizId });
    
    console.log(`Quiz removed from room: ${roomId}`);
  } catch {
    socket.emit('error', { message: 'Failed to remove quiz' });
  }
}

/**
 * Handle quiz start
 * @param socket - Socket instance
 * @param data - Quiz start data
 */
function handleQuizStart(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: { quizId: string; timeLimit?: number }) {
  try {
    const { roomId } = socket.data;
    
    if (!roomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const user = getUser(roomId, socket.data.userId!);
    if (!user || !user.isHost) {
      socket.emit('error', { message: 'Only host can start quizzes' });
      return;
    }
    
    const quiz = room.quizzes.find(q => q.id === data.quizId);
    if (!quiz) {
      socket.emit('error', { message: 'Quiz not found' });
      return;
    }
    
    const timeLimit = data.timeLimit || 30;
    
    // Notify all users in the room
    io.to(roomId).emit('quiz:started', { quiz, timeLimit });
    
    console.log(`Quiz started in room: ${roomId}`);
  } catch {
    socket.emit('error', { message: 'Failed to start quiz' });
  }
}

/**
 * Handle quiz answer
 * @param socket - Socket instance
 * @param data - Quiz answer data
 */
function handleQuizAnswer(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: { quizId: string; answer: string }) {
  try {
    const { roomId, userId } = socket.data;
    
    if (!roomId || !userId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    // Notify all users in the room
    io.to(roomId).emit('quiz:answered', { userId, answer: data.answer });
    
    console.log(`User ${socket.data.userName} answered quiz: ${data.quizId}`);
  } catch {
    socket.emit('error', { message: 'Failed to submit answer' });
  }
}

/**
 * Handle quiz judgment
 * @param socket - Socket instance
 * @param data - Quiz judgment data
 */
function handleQuizJudge(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>, data: { userId: string; isCorrect: boolean; score?: number }) {
  try {
    const { roomId } = socket.data;
    
    if (!roomId) {
      socket.emit('error', { message: 'Not in a room' });
      return;
    }
    
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    const user = getUser(roomId, socket.data.userId!);
    if (!user || !user.isHost) {
      socket.emit('error', { message: 'Only host can judge answers' });
      return;
    }
    
    const score = data.score || (data.isCorrect ? 10 : 0);
    
    // Notify all users in the room
    io.to(roomId).emit('quiz:judged', { 
      userId: data.userId, 
      isCorrect: data.isCorrect, 
      score 
    });
    
    console.log(`Quiz judged for user ${data.userId} in room: ${roomId}`);
  } catch {
    socket.emit('error', { message: 'Failed to judge answer' });
  }
}

/**
 * Handle socket disconnection
 * @param socket - Socket instance
 */
function handleDisconnect(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
  try {
    const { roomId, userId } = socket.data;
    
    if (roomId && userId) {
      const updatedRoom = leaveRoom(roomId, userId);
      
      if (updatedRoom) {
        // Notify other users in the room
        socket.to(roomId).emit('room:userLeft', { userId });
      }
    }
    
    console.log('User disconnected:', socket.id);
  } catch (error) {
    console.error('Error handling disconnect:', error);
  }
}

/**
 * Get Socket.io server instance
 * @returns Socket.io server instance
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.io server not initialized');
  }
  return io;
} 