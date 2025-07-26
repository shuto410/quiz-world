import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  getStoredUserData,
  getStoredUserName,
  getStoredUserId,
  storeUserName,
  storeUserWithId,
  clearStoredUserData,
  hasUserData,
  resetCache,
  getStorageAvailability,
  getStorageType,
  migrateUserData,
} from './userStorage';

describe('User Storage', () => {
  beforeEach(() => {
    // Reset cache before each test
    resetCache();
    
    // Clear all storage
    clearStoredUserData();
  });

  describe('getUserData', () => {
    test('should return null when no user data exists', () => {
      const userData = getStoredUserData();
      expect(userData).toBeNull();
    });

    test('should return user data from localStorage', () => {
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      const userData = getStoredUserData();
      expect(userData).toEqual(testData);
    });

    test('should return user data from sessionStorage when localStorage is empty', () => {
      const testData = { id: 'test-id', name: 'Bob', lastUsed: Date.now() };
      sessionStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      const userData = getStoredUserData();
      expect(userData).toEqual(testData);
    });

    test('should prioritize localStorage over other storages', () => {
      const localData = { id: 'test-id-1', name: 'Alice', lastUsed: Date.now() };
      const sessionData = { id: 'test-id-2', name: 'Bob', lastUsed: Date.now() };
      
      localStorage.setItem('quiz_world_user', JSON.stringify(localData));
      sessionStorage.setItem('quiz_world_user', JSON.stringify(sessionData));
      
      const userData = getStoredUserData();
      expect(userData).toEqual(localData);
    });
  });

  describe('getUserName', () => {
    test('should return user name from storage', () => {
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      const userName = getStoredUserName();
      expect(userName).toBe('Alice');
    });

    test('should return null when no user data exists', () => {
      const userName = getStoredUserName();
      expect(userName).toBeNull();
    });

    test('should store and retrieve user name from localStorage', () => {
      storeUserName('Alice');
      const userName = getStoredUserName();
      expect(userName).toBe('Alice');
    });
  });

  describe('setUserName', () => {
    test('should store user data in localStorage', () => {
      storeUserName('Alice');
      
      const stored = localStorage.getItem('quiz_world_user');
      expect(stored).toBeTruthy();
      
      const userData = JSON.parse(stored!);
      expect(userData.name).toBe('Alice');
      expect(userData.id).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(userData.lastUsed).toBeTypeOf('number');
    });

    test('should include lastUsed timestamp', () => {
      const beforeTime = Date.now();
      storeUserName('Alice');
      const afterTime = Date.now();
      
      const userData = getStoredUserData();
      expect(userData?.lastUsed).toBeGreaterThanOrEqual(beforeTime);
      expect(userData?.lastUsed).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('clearUserData', () => {
    test('should clear data from all storage types', () => {
      storeUserName('Alice');
      expect(hasUserData()).toBe(true);
      
      clearStoredUserData();
      expect(hasUserData()).toBe(false);
    });
  });

  describe('hasUserData', () => {
    test('should return true when user data exists', () => {
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      expect(hasUserData()).toBe(true);
    });

    test('should return false when no user data exists', () => {
      expect(hasUserData()).toBe(false);
    });
  });

  describe('getUserId', () => {
    test('should generate user ID automatically when none exists', () => {
      const userId = getStoredUserId();
      expect(userId).toMatch(/^user_\d+_[a-z0-9]+$/);
    });

    test('should return same user ID on subsequent calls', () => {
      const userId1 = getStoredUserId();
      const userId2 = getStoredUserId();
      expect(userId1).toBe(userId2);
    });

    test('should set user ID with name', () => {
      storeUserWithId('Test User');
      
      const userId = getStoredUserId();
      expect(userId).toMatch(/^user_\d+_[a-z0-9]+$/);
      
      const userData = getStoredUserData();
      expect(userData?.name).toBe('Test User');
    });
  });

  describe('getStorageAvailability', () => {
    test('should return availability status for all storage types', () => {
      const availability = getStorageAvailability();
      expect(availability).toHaveProperty('localStorage');
      expect(availability).toHaveProperty('sessionStorage');
      expect(availability).toHaveProperty('cookie');
    });
  });

  describe('getStorageType', () => {
    test('should return "localStorage" when data is in localStorage', () => {
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      const storageType = getStorageType();
      expect(storageType).toBe('localStorage');
    });

    test('should return "sessionStorage" when data is in sessionStorage but not localStorage', () => {
      const testData = { id: 'test-id', name: 'Bob', lastUsed: Date.now() };
      sessionStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      const storageType = getStorageType();
      expect(storageType).toBe('sessionStorage');
    });

    test('should return null when no data exists in any storage', () => {
      const storageType = getStorageType();
      expect(storageType).toBeNull();
    });
  });

  describe('migrateUserData', () => {
    test('should migrate data to localStorage', () => {
      // Set up initial data in sessionStorage
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      sessionStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      // Migrate to localStorage
      migrateUserData('localStorage');
      
      // Check that data is now in localStorage
      const localData = localStorage.getItem('quiz_world_user');
      expect(localData).toBeTruthy();
      expect(JSON.parse(localData!)).toEqual(testData);
    });

    test('should migrate data to sessionStorage', () => {
      // Set up initial data
      const testData = { id: 'test-id', name: 'Bob', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      // Migrate to sessionStorage
      migrateUserData('sessionStorage');
      
      // Check that data is now in sessionStorage
      const sessionData = sessionStorage.getItem('quiz_world_user');
      expect(sessionData).toBeTruthy();
      expect(JSON.parse(sessionData!)).toEqual(testData);
    });

    test('should do nothing when no user data exists', () => {
      // Try to migrate when no data exists
      migrateUserData('localStorage');
      
      // Should not create any data
      expect(localStorage.getItem('quiz_world_user')).toBeNull();
    });
  });

  describe('Old Format Data Conversion', () => {
    test('should convert old format localStorage data to new format', () => {
      // Set up old format data (without ID)
      const oldData = { name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(oldData));
      
      // Get user data - should convert to new format
      const userData = getStoredUserData();
      
      expect(userData).toBeTruthy();
      expect(userData!.id).toBeTruthy();
      expect(userData!.id).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(userData!.name).toBe('Alice');
      expect(userData!.lastUsed).toBeTypeOf('number');
    });

    test('should convert old format sessionStorage data to new format', () => {
      // Set up old format data (without ID)
      const oldData = { name: 'Bob', lastUsed: Date.now() };
      sessionStorage.setItem('quiz_world_user', JSON.stringify(oldData));
      
      // Get user data - should convert to new format
      const userData = getStoredUserData();
      
      expect(userData).toBeTruthy();
      expect(userData!.id).toBeTruthy();
      expect(userData!.id).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(userData!.name).toBe('Bob');
      expect(userData!.lastUsed).toBeTypeOf('number');
    });

    test('should handle old format data with missing name', () => {
      // Set up old format data without name
      const oldData = { lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(oldData));
      
      // Get user data - should convert to new format
      const userData = getStoredUserData();
      
      expect(userData).toBeTruthy();
      expect(userData!.id).toBeTruthy();
      expect(userData!.name).toBe('');
      expect(userData!.lastUsed).toBeTypeOf('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted localStorage data', () => {
      // Set corrupted JSON data
      localStorage.setItem('quiz_world_user', 'invalid-json');
      
      // Should not throw error and return null
      const userData = getStoredUserData();
      expect(userData).toBeNull();
    });

    test('should handle corrupted sessionStorage data', () => {
      // Set corrupted JSON data
      sessionStorage.setItem('quiz_world_user', 'invalid-json');
      
      // Should not throw error and return null
      const userData = getStoredUserData();
      expect(userData).toBeNull();
    });

    test('should handle clearUserData errors gracefully', () => {
      // Mock localStorage to throw error
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      // Should not throw error
      expect(() => clearStoredUserData()).not.toThrow();
      
      // Restore original method
      localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('Edge Cases', () => {
    test('should handle getUserId when existing user data does not have ID', () => {
      // Set up user data without ID
      const userData = { name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(userData));
      
      // Get user ID - should generate new ID and preserve name
      const userId = getStoredUserId();
      
      expect(userId).toBeTruthy();
      expect(userId).toMatch(/^user_\d+_[a-z0-9]+$/);
      
      // Check that name is preserved
      const updatedUserData = getStoredUserData();
      expect(updatedUserData!.name).toBe('Alice');
      expect(updatedUserData!.id).toBe(userId);
    });

    test('should update lastUsed timestamp when getting existing user ID', () => {
      // Set up existing user data with ID
      const existingData = { id: 'existing-id', name: 'Alice', lastUsed: Date.now() - 10000 };
      localStorage.setItem('quiz_world_user', JSON.stringify(existingData));
      
      // Reset cache to force reading from storage
      resetCache();
      
      const beforeTime = Date.now();
      const userId = getStoredUserId();
      const afterTime = Date.now();
      
      expect(userId).toBe('existing-id');
      
      // Check that lastUsed is updated
      const updatedData = getStoredUserData();
      expect(updatedData!.lastUsed).toBeGreaterThanOrEqual(beforeTime);
      expect(updatedData!.lastUsed).toBeLessThanOrEqual(afterTime);
    });

    test('should handle setUserWithId when user data already exists', () => {
      // Set up existing user data
      const existingData = { id: 'existing-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(existingData));
      
      // Update user with new name
      storeUserWithId('Bob');
      
      // Check that ID is preserved and name is updated
      const userData = getStoredUserData();
      expect(userData!.id).toBe('existing-id');
      expect(userData!.name).toBe('Bob');
    });

    test('should handle setUserWithId when no user data exists', () => {
      // Set user name when no data exists
      storeUserWithId('Charlie');
      
      // Check that new user data is created
      const userData = getStoredUserData();
      expect(userData).toBeTruthy();
      expect(userData!.id).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(userData!.name).toBe('Charlie');
    });
  });

  describe('Cache Behavior', () => {
    test('should return cached data on subsequent calls', () => {
      // Set up data
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      // First call - should read from storage
      const userData1 = getStoredUserData();
      
      // Remove from storage to test cache
      localStorage.removeItem('quiz_world_user');
      
      // Second call - should return cached data
      const userData2 = getStoredUserData();
      
      expect(userData2).toEqual(userData1);
    });

    test('should clear cache when resetCache is called', () => {
      // Set up data
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      // Load data into cache
      getStoredUserData();
      
      // Clear storage and reset cache
      localStorage.removeItem('quiz_world_user');
      resetCache();
      
      // Should return null since cache is cleared and storage is empty
      const userData = getStoredUserData();
      expect(userData).toBeNull();
    });
  });
}); 