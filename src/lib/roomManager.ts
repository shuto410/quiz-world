/**
 * Room management utilities for Quiz World application
 * - Room creation, joining, leaving
 * - User management within rooms
 * - Host transfer functionality
 */

import { v4 as uuidv4 } from 'uuid';
import type { Room, User } from '../types';
import { getRandomQuizzes } from '../data/mockQuizzes';

/**
 * In-memory storage for rooms (in production, this would be a database)
 */
const rooms = new Map<string, Room>();

/**
 * Track when rooms become empty for cleanup purposes
 */
const emptyRoomTimestamps = new Map<string, number>();

/**
 * Creates a new room with the specified parameters
 * @param name - Room name
 * @param isPublic - Whether the room is public
 * @param maxPlayers - Maximum number of players (default: 8)
 * @param hostName - Name of the host user
 * @returns The created room
 */
export function createRoom(
  name: string,
  isPublic: boolean,
  maxPlayers: number = 8,
  hostName: string
): Room {
  const roomId = uuidv4();
  const hostId = uuidv4();
  
  const host: User = {
    id: hostId,
    name: hostName,
    isHost: true,
  };

  const room: Room = {
    id: roomId,
    name,
    isPublic,
    users: [host],
    quizzes: [],
    hostId,
    maxPlayers,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  return room;
}

/**
 * Creates a new room with a specific host user ID
 * @param name - Room name
 * @param isPublic - Whether the room is public
 * @param maxPlayers - Maximum number of players (default: 8)
 * @param hostName - Name of the host user
 * @param hostId - Specific host user ID to use
 * @returns The created room
 */
export function createRoomWithHost(
  name: string,
  isPublic: boolean,
  maxPlayers: number = 8,
  hostName: string,
  hostId: string
): Room {
  const roomId = uuidv4();
  
  const host: User = {
    id: hostId,
    name: hostName,
    isHost: true,
  };

  const room: Room = {
    id: roomId,
    name,
    isPublic,
    users: [host],
    quizzes: [],
    hostId,
    maxPlayers,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  return room;
}

/**
 * Joins a user to an existing room
 * @param roomId - Room ID to join
 * @param userName - Name of the user joining
 * @param userId - Optional existing user ID to reuse
 * @returns The room and user if successful, null if room is full or doesn't exist
 */
export function joinRoom(roomId: string, userName: string, userId?: string): { room: Room; user: User } | null {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  if (room.users.length >= room.maxPlayers) {
    return null;
  }

  // If userId is provided, check if user already exists in the room
  if (userId) {
    const existingUser = room.users.find(user => user.id === userId);
    if (existingUser) {
      // Update user name if it has changed
      if (existingUser.name !== userName) {
        existingUser.name = userName;
      }
      console.log(`User ${userName} (${userId}) already exists in room, returning existing user`);
      return { room, user: existingUser };
    }
  }

  // Special handling for original host returning to empty room
  const isOriginalHostReturning = Boolean(userId && room.hostId === userId && room.users.length === 0);
  
  const user: User = {
    id: userId || uuidv4(),
    name: userName,
    isHost: isOriginalHostReturning, // Restore host status if original host is returning
  };

  room.users.push(user);
  
  if (isOriginalHostReturning) {
    // Clear empty room timestamp when host returns
    emptyRoomTimestamps.delete(roomId);
    console.log(`Original host ${userName} (${userId}) returned to empty room, restoring host status`);
  } else {
    console.log(`New user ${userName} (${user.id}) added to room`);
  }
  
  return { room, user };
}

/**
 * Removes a user from a room
 * @param roomId - Room ID
 * @param userId - User ID to remove
 * @returns The updated room if successful, null if room or user doesn't exist
 */
export function leaveRoom(roomId: string, userId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  const userIndex = room.users.findIndex(user => user.id === userId);
  if (userIndex === -1) {
    return null;
  }

  const isHostLeaving = room.hostId === userId;
  room.users.splice(userIndex, 1);

  // If the host left and there are other users, transfer host to the first user
  if (isHostLeaving && room.users.length > 0) {
    room.hostId = room.users[0].id;
    room.users[0].isHost = true;
  }

  // Special handling for host leaving empty room - keep room for host to return
  if (room.users.length === 0 && isHostLeaving) {
    // Track when room becomes empty for potential cleanup
    emptyRoomTimestamps.set(roomId, Date.now());
    console.log(`Host left empty room ${roomId}, preserving room for potential return`);
    return room; // Return the empty room instead of deleting it
  }
  
  // If no users left and it's not a host leaving (edge case), delete the room
  if (room.users.length === 0) {
    rooms.delete(roomId);
    return null;
  }

  return room;
}

/**
 * Transfers host role to another user
 * @param roomId - Room ID
 * @param newHostId - New host user ID
 * @returns The updated room if successful, null if room or user doesn't exist
 */
export function transferHost(roomId: string, newHostId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  const newHost = room.users.find(user => user.id === newHostId);
  if (!newHost) {
    return null;
  }

  // Remove host role from current host
  const currentHost = room.users.find(user => user.id === room.hostId);
  if (currentHost) {
    currentHost.isHost = false;
  }

  // Assign host role to new host
  newHost.isHost = true;
  room.hostId = newHostId;

  return room;
}

/**
 * Updates room properties
 * @param roomId - Room ID
 * @param updates - Properties to update
 * @returns The updated room if successful, null if room doesn't exist
 */
export function updateRoom(
  roomId: string,
  updates: { name?: string; isPublic?: boolean }
): Room | null {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  if (updates.name !== undefined) {
    room.name = updates.name;
  }
  if (updates.isPublic !== undefined) {
    room.isPublic = updates.isPublic;
  }

  return room;
}

/**
 * Gets a list of public rooms
 * @returns Array of public rooms
 */
export function getPublicRooms(): Room[] {
  return Array.from(rooms.values()).filter(room => room.isPublic);
}

/**
 * Gets a room by ID
 * @param roomId - Room ID
 * @returns The room if it exists, null otherwise
 */
export function getRoom(roomId: string): Room | null {
  return rooms.get(roomId) || null;
}

/**
 * Gets a user from a room
 * @param roomId - Room ID
 * @param userId - User ID
 * @returns The user if found, null otherwise
 */
export function getUser(roomId: string, userId: string): User | null {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }
  return room.users.find(user => user.id === userId) || null;
}

/**
 * Cleans up abandoned rooms that have been empty for too long
 * @param maxEmptyDurationMs - Maximum time a room can be empty before cleanup (default: 30 minutes)
 * @returns Number of rooms cleaned up
 */
export function cleanupAbandonedRooms(maxEmptyDurationMs: number = 30 * 60 * 1000): number {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [roomId, timestamp] of emptyRoomTimestamps.entries()) {
    if (now - timestamp > maxEmptyDurationMs) {
      rooms.delete(roomId);
      emptyRoomTimestamps.delete(roomId);
      console.log(`Cleaned up abandoned room ${roomId}`);
      cleanedCount++;
    }
  }
  
  return cleanedCount;
}

/**
 * Gets the number of empty rooms being tracked
 * @returns Number of empty rooms
 */
export function getEmptyRoomsCount(): number {
  return emptyRoomTimestamps.size;
}

/**
 * Gets information about empty rooms and their timestamps
 * @returns Array of room IDs and their empty timestamps
 */
export function getEmptyRoomsInfo(): Array<{ roomId: string; emptyDuration: number }> {
  const now = Date.now();
  return Array.from(emptyRoomTimestamps.entries()).map(([roomId, timestamp]) => ({
    roomId,
    emptyDuration: now - timestamp,
  }));
}

/**
 * Resets all room state (for testing purposes)
 */
export function resetRoomState(): void {
  rooms.clear();
  emptyRoomTimestamps.clear();
}

/**
 * Create a demo room with mock quiz data (for development)
 * @param hostName - Name of the host user
 * @param hostId - Host user ID
 * @returns The created demo room
 */
export function createDemoRoom(hostName: string = 'デモホスト', hostId?: string): Room {
  const roomId = uuidv4();
  const demoHostId = hostId || uuidv4();
  
  const host: User = {
    id: demoHostId,
    name: hostName,
    isHost: true,
  };

  const room: Room = {
    id: roomId,
    name: '🎯 デモルーム (サンプルクイズ付き)',
    isPublic: true,
    users: [host],
    quizzes: getRandomQuizzes(5), // 5個のランダムなクイズを追加
    hostId: demoHostId,
    maxPlayers: 8,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  console.log(`Demo room created: ${roomId} with ${room.quizzes.length} quizzes`);
  return room;
}

/**
 * Initialize demo data for development environment
 * Creates sample rooms with mock quiz data
 */
export function initializeDemoData(): void {
  // Only initialize in development environment
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    // Check if demo room already exists
    const existingDemoRoom = Array.from(rooms.values()).find(room => 
      room.name.includes('デモルーム')
    );
    
    if (!existingDemoRoom) {
      // Create demo room with various quiz types
      createDemoRoom();
      console.log('Demo room initialized for development');
    }
  }
} 