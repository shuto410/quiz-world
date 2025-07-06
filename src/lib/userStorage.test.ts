import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getUserData,
  getUserName,
  setUserName,
  clearUserData,
  hasUserData,
  getStorageType,
  migrateUserData,
  getStorageAvailability,
  type UserData,
} from './userStorage';

describe('User Storage', () => {
  // Mock browser APIs
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  const mockSessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  const mockDocument = {
    cookie: '',
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock window and document
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStorage,
      },
      writable: true,
    });

    Object.defineProperty(global, 'document', {
      value: mockDocument,
      writable: true,
    });
  });

  afterEach(() => {
    // Clean up
    clearUserData();
  });

  describe('getUserData', () => {
    test('should return null when no user data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      expect(getUserData()).toBeNull();
    });

    test('should return user data from localStorage', () => {
      const userData: UserData = { name: 'Alice', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      const result = getUserData();
      expect(result).toEqual(userData);
    });

    test('should return user data from sessionStorage when localStorage is empty', () => {
      const userData: UserData = { name: 'Bob', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(userData));
      mockDocument.cookie = '';

      const result = getUserData();
      expect(result).toEqual(userData);
    });

    test('should return user data from cookie when other storages are empty', () => {
      const userData: UserData = { name: 'Charlie', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = `quiz_world_user=${encodeURIComponent(JSON.stringify(userData))}`;

      const result = getUserData();
      expect(result).toEqual(userData);
    });

    test('should prioritize localStorage over other storages', () => {
      const localStorageData: UserData = { name: 'Alice', lastUsed: Date.now() };
      const sessionStorageData: UserData = { name: 'Bob', lastUsed: Date.now() };
      const cookieData: UserData = { name: 'Charlie', lastUsed: Date.now() };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(localStorageData));
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionStorageData));
      mockDocument.cookie = `quiz_world_user=${encodeURIComponent(JSON.stringify(cookieData))}`;

      const result = getUserData();
      expect(result).toEqual(localStorageData);
    });
  });

  describe('getUserName', () => {
    test('should return user name from storage', () => {
      const userData: UserData = { name: 'Alice', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));

      expect(getUserName()).toBe('Alice');
    });

    test('should return null when no user data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      expect(getUserName()).toBeNull();
    });
  });

  describe('setUserName', () => {
    test('should store user data in all storage types', () => {
      setUserName('Alice');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'quiz_world_user',
        expect.stringContaining('"name":"Alice"')
      );
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'quiz_world_user',
        expect.stringContaining('"name":"Alice"')
      );
      expect(mockDocument.cookie).toContain('quiz_world_user=');
      // Check decoded cookie value
      const cookieValue = decodeURIComponent(mockDocument.cookie.split('=')[1].split(';')[0]);
      expect(cookieValue).toContain('"name":"Alice"');
    });

    test('should include lastUsed timestamp', () => {
      const before = Date.now();
      setUserName('Alice');
      const after = Date.now();

      const storedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(storedData.lastUsed).toBeGreaterThanOrEqual(before);
      expect(storedData.lastUsed).toBeLessThanOrEqual(after);
    });
  });

  describe('clearUserData', () => {
    test('should clear data from all storage types', () => {
      clearUserData();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('quiz_world_user');
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('quiz_world_user');
      expect(mockDocument.cookie).toContain('quiz_world_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC');
    });
  });

  describe('hasUserData', () => {
    test('should return true when user data exists', () => {
      const userData: UserData = { name: 'Alice', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));

      expect(hasUserData()).toBe(true);
    });

    test('should return false when no user data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      expect(hasUserData()).toBe(false);
    });
  });

  describe('getStorageType', () => {
    test('should return localStorage when data exists there', () => {
      const userData: UserData = { name: 'Alice', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      expect(getStorageType()).toBe('localStorage');
    });

    test('should return sessionStorage when data exists there', () => {
      const userData: UserData = { name: 'Bob', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(userData));
      mockDocument.cookie = '';

      expect(getStorageType()).toBe('sessionStorage');
    });

    test('should return cookie when data exists there', () => {
      const userData: UserData = { name: 'Charlie', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = `quiz_world_user=${encodeURIComponent(JSON.stringify(userData))}`;

      expect(getStorageType()).toBe('cookie');
    });

    test('should return null when no data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      expect(getStorageType()).toBeNull();
    });
  });

  describe('migrateUserData', () => {
    test('should migrate data to localStorage', () => {
      const userData: UserData = { name: 'Alice', lastUsed: Date.now() };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(userData));

      migrateUserData('localStorage');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'quiz_world_user',
        JSON.stringify(userData)
      );
    });

    test('should migrate data to sessionStorage', () => {
      const userData: UserData = { name: 'Bob', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));

      migrateUserData('sessionStorage');

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'quiz_world_user',
        JSON.stringify(userData)
      );
    });

    test('should migrate data to cookie', () => {
      const userData: UserData = { name: 'Charlie', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));

      migrateUserData('cookie');

      expect(mockDocument.cookie).toContain('quiz_world_user=');
      // Check decoded cookie value
      const cookieValue = decodeURIComponent(mockDocument.cookie.split('=')[1].split(';')[0]);
      expect(cookieValue).toContain('"name":"Charlie"');
    });

    test('should do nothing when no data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      migrateUserData('localStorage');

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('getStorageAvailability', () => {
    test('should return availability status for all storage types', () => {
      const availability = getStorageAvailability();

      expect(availability).toEqual({
        localStorage: true,
        sessionStorage: true,
        cookie: true,
      });
    });

    test('should handle missing window object', () => {
      // Mock window as undefined
      const originalWindow = global.window;
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });

      const availability = getStorageAvailability();

      expect(availability).toEqual({
        localStorage: false,
        sessionStorage: false,
        cookie: true, // document still exists
      });

      // Restore window
      global.window = originalWindow;
    });

    test('should handle missing document object', () => {
      // Mock document as undefined
      const originalDocument = global.document;
      Object.defineProperty(global, 'document', {
        value: undefined,
        writable: true,
      });

      const availability = getStorageAvailability();

      expect(availability).toEqual({
        localStorage: true,
        sessionStorage: true,
        cookie: false,
      });

      // Restore document
      global.document = originalDocument;
    });
  });

  describe('Error Handling', () => {
    test('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => getUserData()).not.toThrow();
      expect(getUserData()).toBeNull();
    });

    test('should handle sessionStorage errors gracefully', () => {
      mockSessionStorage.getItem.mockImplementation(() => {
        throw new Error('sessionStorage error');
      });

      expect(() => getUserData()).not.toThrow();
      expect(getUserData()).toBeNull();
    });

    test('should handle cookie parsing errors gracefully', () => {
      mockDocument.cookie = 'quiz_world_user=invalid-json';

      expect(() => getUserData()).not.toThrow();
      expect(getUserData()).toBeNull();
    });

    test('should handle setUserName errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage set error');
      });

      expect(() => setUserName('Alice')).not.toThrow();
    });
  });
}); 