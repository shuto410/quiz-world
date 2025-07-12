import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  getUserData,
  getUserName,
  getUserId,
  setUserName,
  setUserWithId,
  clearUserData,
  hasUserData,
  resetCache,
  getStorageAvailability,
} from './userStorage';

describe('User Storage', () => {
  beforeEach(() => {
    // Reset cache before each test
    resetCache();
    
    // Clear all storage
    clearUserData();
  });

  describe('getUserData', () => {
    test('should return null when no user data exists', () => {
      const userData = getUserData();
      expect(userData).toBeNull();
    });

    test('should return user data from localStorage', () => {
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      const userData = getUserData();
      expect(userData).toEqual(testData);
    });

    test('should return user data from sessionStorage when localStorage is empty', () => {
      const testData = { id: 'test-id', name: 'Bob', lastUsed: Date.now() };
      sessionStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      const userData = getUserData();
      expect(userData).toEqual(testData);
    });

    test('should prioritize localStorage over other storages', () => {
      const localData = { id: 'test-id-1', name: 'Alice', lastUsed: Date.now() };
      const sessionData = { id: 'test-id-2', name: 'Bob', lastUsed: Date.now() };
      
      localStorage.setItem('quiz_world_user', JSON.stringify(localData));
      sessionStorage.setItem('quiz_world_user', JSON.stringify(sessionData));
      
      const userData = getUserData();
      expect(userData).toEqual(localData);
    });
  });

  describe('getUserName', () => {
    test('should return user name from storage', () => {
      const testData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      localStorage.setItem('quiz_world_user', JSON.stringify(testData));
      
      const userName = getUserName();
      expect(userName).toBe('Alice');
    });

    test('should return null when no user data exists', () => {
      const userName = getUserName();
      expect(userName).toBeNull();
    });

    test('should store and retrieve user name from localStorage', () => {
      setUserName('Alice');
      const userName = getUserName();
      expect(userName).toBe('Alice');
    });
  });

  describe('setUserName', () => {
    test('should store user data in localStorage', () => {
      setUserName('Alice');
      
      const stored = localStorage.getItem('quiz_world_user');
      expect(stored).toBeTruthy();
      
      const userData = JSON.parse(stored!);
      expect(userData.name).toBe('Alice');
      expect(userData.id).toMatch(/^user_\d+_[a-z0-9]+$/);
      expect(userData.lastUsed).toBeTypeOf('number');
    });

    test('should include lastUsed timestamp', () => {
      const beforeTime = Date.now();
      setUserName('Alice');
      const afterTime = Date.now();
      
      const userData = getUserData();
      expect(userData?.lastUsed).toBeGreaterThanOrEqual(beforeTime);
      expect(userData?.lastUsed).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('clearUserData', () => {
    test('should clear data from all storage types', () => {
      setUserName('Alice');
      expect(hasUserData()).toBe(true);
      
      clearUserData();
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
      const userId = getUserId();
      expect(userId).toMatch(/^user_\d+_[a-z0-9]+$/);
    });

    test('should return same user ID on subsequent calls', () => {
      const userId1 = getUserId();
      const userId2 = getUserId();
      expect(userId1).toBe(userId2);
    });

    test('should set user ID with name', () => {
      setUserWithId('Test User');
      
      const userId = getUserId();
      expect(userId).toMatch(/^user_\d+_[a-z0-9]+$/);
      
      const userData = getUserData();
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
}); 