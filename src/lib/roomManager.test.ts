import { describe, test, expect, beforeEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  transferHost,
  updateRoom,
  getPublicRooms,
  getRoom,
  getUser,
} from './roomManager';
import type { Room, User } from '../types';

describe('Room Manager', () => {
  let testRoom: Room;
  let testUser: User;

  beforeEach(() => {
    // Clear any existing rooms by creating a fresh instance
    // In a real implementation, we'd have a way to reset the rooms map
    testRoom = createRoom('Test Room', true, 8, 'Host User');
    testUser = testRoom.users[0];
  });

  describe('createRoom', () => {
    test('should create a room with correct properties', () => {
      const room = createRoom('New Room', false, 4, 'Alice');
      
      expect(room.name).toBe('New Room');
      expect(room.isPublic).toBe(false);
      expect(room.maxPlayers).toBe(4);
      expect(room.users).toHaveLength(1);
      expect(room.users[0].name).toBe('Alice');
      expect(room.users[0].isHost).toBe(true);
      expect(room.hostId).toBe(room.users[0].id);
      expect(room.quizzes).toHaveLength(0);
    });

    test('should create a room with default maxPlayers', () => {
      const room = createRoom('Default Room', true, undefined, 'Bob');
      expect(room.maxPlayers).toBe(8);
    });
  });

  describe('joinRoom', () => {
    test('should allow a user to join a room', () => {
      const result = joinRoom(testRoom.id, 'New User');
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.room.id).toBe(testRoom.id);
        expect(result.user.name).toBe('New User');
        expect(result.user.isHost).toBe(false);
        expect(result.room.users).toHaveLength(2);
      }
    });

    test('should return null for non-existent room', () => {
      const result = joinRoom('non-existent-id', 'User');
      expect(result).toBeNull();
    });

    test('should return null when room is full', () => {
      // Fill the room to capacity
      for (let i = 1; i < testRoom.maxPlayers; i++) {
        joinRoom(testRoom.id, `User ${i}`);
      }
      
      const result = joinRoom(testRoom.id, 'Extra User');
      expect(result).toBeNull();
    });
  });

  describe('leaveRoom', () => {
    test('should remove a user from the room', () => {
      const newUser = joinRoom(testRoom.id, 'Leaving User');
      expect(newUser).not.toBeNull();
      
      if (newUser) {
        const updatedRoom = leaveRoom(testRoom.id, newUser.user.id);
        expect(updatedRoom).not.toBeNull();
        if (updatedRoom) {
          expect(updatedRoom.users).toHaveLength(1);
          expect(updatedRoom.users[0].id).toBe(testUser.id);
        }
      }
    });

    test('should transfer host when host leaves', () => {
      const newUser = joinRoom(testRoom.id, 'New Host');
      expect(newUser).not.toBeNull();
      
      if (newUser) {
        const updatedRoom = leaveRoom(testRoom.id, testUser.id);
        expect(updatedRoom).not.toBeNull();
        if (updatedRoom) {
          expect(updatedRoom.hostId).toBe(newUser.user.id);
          expect(updatedRoom.users[0].isHost).toBe(true);
        }
      }
    });

    test('should delete room when last user leaves', () => {
      const result = leaveRoom(testRoom.id, testUser.id);
      expect(result).toBeNull();
      
      const retrievedRoom = getRoom(testRoom.id);
      expect(retrievedRoom).toBeNull();
    });

    test('should return null for non-existent room', () => {
      const result = leaveRoom('non-existent-id', 'user-id');
      expect(result).toBeNull();
    });

    test('should return null for non-existent user', () => {
      const result = leaveRoom(testRoom.id, 'non-existent-user');
      expect(result).toBeNull();
    });
  });

  describe('transferHost', () => {
    test('should transfer host role to another user', () => {
      const newUser = joinRoom(testRoom.id, 'New Host');
      expect(newUser).not.toBeNull();
      
      if (newUser) {
        const updatedRoom = transferHost(testRoom.id, newUser.user.id);
        expect(updatedRoom).not.toBeNull();
        if (updatedRoom) {
          expect(updatedRoom.hostId).toBe(newUser.user.id);
          expect(updatedRoom.users.find(u => u.id === newUser.user.id)?.isHost).toBe(true);
          expect(updatedRoom.users.find(u => u.id === testUser.id)?.isHost).toBe(false);
        }
      }
    });

    test('should return null for non-existent room', () => {
      const result = transferHost('non-existent-id', 'user-id');
      expect(result).toBeNull();
    });

    test('should return null for non-existent user', () => {
      const result = transferHost(testRoom.id, 'non-existent-user');
      expect(result).toBeNull();
    });
  });

  describe('updateRoom', () => {
    test('should update room name', () => {
      const updatedRoom = updateRoom(testRoom.id, { name: 'Updated Room' });
      expect(updatedRoom).not.toBeNull();
      if (updatedRoom) {
        expect(updatedRoom.name).toBe('Updated Room');
      }
    });

    test('should update room visibility', () => {
      const updatedRoom = updateRoom(testRoom.id, { isPublic: false });
      expect(updatedRoom).not.toBeNull();
      if (updatedRoom) {
        expect(updatedRoom.isPublic).toBe(false);
      }
    });

    test('should update multiple properties', () => {
      const updatedRoom = updateRoom(testRoom.id, {
        name: 'Multi Updated',
        isPublic: false,
      });
      expect(updatedRoom).not.toBeNull();
      if (updatedRoom) {
        expect(updatedRoom.name).toBe('Multi Updated');
        expect(updatedRoom.isPublic).toBe(false);
      }
    });

    test('should return null for non-existent room', () => {
      const result = updateRoom('non-existent-id', { name: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('getPublicRooms', () => {
    test('should return only public rooms', () => {
      // Create a private room
      createRoom('Private Room', false, 8, 'Private Host');
      
      const publicRooms = getPublicRooms();
      expect(publicRooms.length).toBeGreaterThan(0);
      publicRooms.forEach(room => {
        expect(room.isPublic).toBe(true);
      });
    });
  });

  describe('getRoom', () => {
    test('should return room by ID', () => {
      const room = getRoom(testRoom.id);
      expect(room).not.toBeNull();
      if (room) {
        expect(room.id).toBe(testRoom.id);
        expect(room.name).toBe('Test Room');
      }
    });

    test('should return null for non-existent room', () => {
      const room = getRoom('non-existent-id');
      expect(room).toBeNull();
    });
  });

  describe('getUser', () => {
    test('should return user from room', () => {
      const user = getUser(testRoom.id, testUser.id);
      expect(user).not.toBeNull();
      if (user) {
        expect(user.id).toBe(testUser.id);
        expect(user.name).toBe('Host User');
      }
    });

    test('should return null for non-existent room', () => {
      const user = getUser('non-existent-id', 'user-id');
      expect(user).toBeNull();
    });

    test('should return null for non-existent user', () => {
      const user = getUser(testRoom.id, 'non-existent-user');
      expect(user).toBeNull();
    });
  });
}); 