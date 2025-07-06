/**
 * Room management utilities for Quiz World application
 * - Room creation, joining, leaving
 * - User management within rooms
 * - Host transfer functionality
 */

import { v4 as uuidv4 } from 'uuid';
import type { Room, User } from '../types';

/**
 * In-memory storage for rooms (in production, this would be a database)
 */
const rooms = new Map<string, Room>();

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
  };

  rooms.set(roomId, room);
  return room;
}

/**
 * Joins a user to an existing room
 * @param roomId - Room ID to join
 * @param userName - Name of the user joining
 * @returns The room and user if successful, null if room is full or doesn't exist
 */
export function joinRoom(roomId: string, userName: string): { room: Room; user: User } | null {
  const room = rooms.get(roomId);
  if (!room) {
    return null;
  }

  if (room.users.length >= room.maxPlayers) {
    return null;
  }

  const user: User = {
    id: uuidv4(),
    name: userName,
    isHost: false,
  };

  room.users.push(user);
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

  room.users.splice(userIndex, 1);

  // If the host left and there are other users, transfer host to the first user
  if (room.hostId === userId && room.users.length > 0) {
    room.hostId = room.users[0].id;
    room.users[0].isHost = true;
  }

  // If no users left, delete the room
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