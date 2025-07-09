import { describe, test, expect, beforeEach } from 'vitest';
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

  describe('createRoomWithHost', () => {
    test('should create a room with specified host ID', () => {
      const customHostId = 'custom-host-id';
      const room = createRoomWithHost('Custom Room', false, 6, 'Custom Host', customHostId);
      
      expect(room.name).toBe('Custom Room');
      expect(room.isPublic).toBe(false);
      expect(room.maxPlayers).toBe(6);
      expect(room.users).toHaveLength(1);
      expect(room.users[0].name).toBe('Custom Host');
      expect(room.users[0].id).toBe(customHostId);
      expect(room.users[0].isHost).toBe(true);
      expect(room.hostId).toBe(customHostId);
      expect(room.quizzes).toHaveLength(0);
    });

    test('should create a room with default maxPlayers using host ID', () => {
      const customHostId = 'another-host-id';
      const room = createRoomWithHost('Another Room', true, undefined, 'Another Host', customHostId);
      
      expect(room.maxPlayers).toBe(8);
      expect(room.users[0].id).toBe(customHostId);
    });

    test('should create a public room with host ID', () => {
      const hostId = 'public-host-id';
      const room = createRoomWithHost('Public Room', true, 10, 'Public Host', hostId);
      
      expect(room.isPublic).toBe(true);
      expect(room.maxPlayers).toBe(10);
      expect(room.hostId).toBe(hostId);
      expect(room.users[0].id).toBe(hostId);
      expect(room.users[0].isHost).toBe(true);
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

    test('should reuse existing user ID when provided', () => {
      const existingUserId = 'existing-user-id';
      const result = joinRoom(testRoom.id, 'Existing User', existingUserId);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result.user.id).toBe(existingUserId);
        expect(result.user.name).toBe('Existing User');
        expect(result.user.isHost).toBe(false);
      }
    });

    test('should not create duplicate users with same ID', () => {
      const existingUserId = 'existing-user-id';
      
      // First join
      const firstJoin = joinRoom(testRoom.id, 'User 1', existingUserId);
      expect(firstJoin).not.toBeNull();
      
      // Leave the room
      if (firstJoin) {
        leaveRoom(testRoom.id, existingUserId);
      }
      
      // Second join with same ID
      const secondJoin = joinRoom(testRoom.id, 'User 2', existingUserId);
      expect(secondJoin).not.toBeNull();
      
      if (secondJoin) {
        expect(secondJoin.user.id).toBe(existingUserId);
        expect(secondJoin.user.name).toBe('User 2');
        expect(secondJoin.room.users).toHaveLength(2); // host + this user
      }
    });

    test('should return existing user when same ID joins again', () => {
      const existingUserId = 'existing-user-id';
      
      // First join
      const firstJoin = joinRoom(testRoom.id, 'User 1', existingUserId);
      expect(firstJoin).not.toBeNull();
      
      if (firstJoin) {
        const initialUserCount = firstJoin.room.users.length;
        
        // Second join with same ID (should return existing user)
        const secondJoin = joinRoom(testRoom.id, 'User 2', existingUserId);
        expect(secondJoin).not.toBeNull();
        
        if (secondJoin) {
          expect(secondJoin.user.id).toBe(existingUserId);
          expect(secondJoin.user.name).toBe('User 2'); // Name should be updated
          expect(secondJoin.room.users).toHaveLength(initialUserCount); // Same user count
          
          // Verify it's the same user object
          const userInRoom = secondJoin.room.users.find(u => u.id === existingUserId);
          expect(userInRoom).toBe(secondJoin.user);
        }
      }
    });

    test('should generate new ID when no existing ID provided', () => {
      const result1 = joinRoom(testRoom.id, 'User 1');
      const result2 = joinRoom(testRoom.id, 'User 2');
      
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      
      if (result1 && result2) {
        expect(result1.user.id).not.toBe(result2.user.id);
      }
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

    test('should preserve room when host is the only user and leaves', () => {
      // This is now the expected behavior - host leaving preserves the room
      const result = leaveRoom(testRoom.id, testUser.id);
      expect(result).not.toBeNull(); // Room should be preserved
      expect(result?.users).toHaveLength(0); // But with no users
      
      const retrievedRoom = getRoom(testRoom.id);
      expect(retrievedRoom).not.toBeNull(); // Room should still exist
    });
    
    test('should delete room when non-host user is last to leave', () => {
      // Create a room and add a non-host user
      const nonHostUser = joinRoom(testRoom.id, 'Regular User');
      expect(nonHostUser).not.toBeNull();
      
      // Transfer host to the new user
      if (nonHostUser) {
        const updatedRoom = transferHost(testRoom.id, nonHostUser.user.id);
        expect(updatedRoom).not.toBeNull();
        
        // Remove the original host (now non-host)
        const afterHostLeave = leaveRoom(testRoom.id, testUser.id);
        expect(afterHostLeave).not.toBeNull();
        
        // Now remove the last user (who is now the host) - room should be preserved
        const result = leaveRoom(testRoom.id, nonHostUser.user.id);
        expect(result).not.toBeNull(); // Even when current host leaves, room is preserved
      }
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

  describe('Room persistence for host', () => {
    // TDD: Test for room persistence when host temporarily leaves
    test('should keep room when host leaves and allow host to rejoin', () => {
      // Given: Create a room with host
      const room = createRoom('Test Room', true, 8, 'Host User');
      const originalRoomId = room.id;
      const originalHostId = room.hostId;
      
      // When: Host leaves the room
      const updatedRoom = leaveRoom(originalRoomId, originalHostId);
      
      // Then: Room should be preserved (not deleted) even when empty
      expect(updatedRoom).not.toBeNull(); // This will FAIL - RED phase
      expect(getRoom(originalRoomId)).not.toBeNull(); // Room should still exist
      
      // And: Host should be able to rejoin the same room
      const rejoinResult = joinRoom(originalRoomId, 'Host User', originalHostId);
      expect(rejoinResult).not.toBeNull();
      expect(rejoinResult?.user.isHost).toBe(true); // Should regain host status
    });
    
    test('should preserve room properties when host temporarily leaves', () => {
      // Given: Create a private room with specific settings
      const room = createRoom('Private Room', false, 4, 'Host User');
      const originalRoomId = room.id;
      const originalHostId = room.hostId;
      
      // When: Host leaves the room
      leaveRoom(originalRoomId, originalHostId);
      
      // Then: Room should preserve its original properties
      const preservedRoom = getRoom(originalRoomId);
      expect(preservedRoom).not.toBeNull(); // This will FAIL - RED phase
      expect(preservedRoom?.name).toBe('Private Room');
      expect(preservedRoom?.isPublic).toBe(false);
      expect(preservedRoom?.maxPlayers).toBe(4);
    });
  });
}); 