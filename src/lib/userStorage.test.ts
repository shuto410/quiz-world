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
  getUserId,
  setUserWithId,
  resetCache,
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
      const userData: UserData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      const result = getUserData();
      expect(result).toEqual(userData);
    });

    test('should return user data from sessionStorage when localStorage is empty', () => {
      const userData: UserData = { id: 'test-id', name: 'Bob', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(userData));
      mockDocument.cookie = '';

      const result = getUserData();
      expect(result).toEqual(userData);
    });

    test('should return user data from cookie when other storages are empty', () => {
      const userData: UserData = { id: 'test-id', name: 'Charlie', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = `quiz_world_user=${encodeURIComponent(JSON.stringify(userData))}`;

      const result = getUserData();
      expect(result).toEqual(userData);
    });

    test('should prioritize localStorage over other storages', () => {
      const localStorageData: UserData = { id: 'test-id-1', name: 'Alice', lastUsed: Date.now() };
      const sessionStorageData: UserData = { id: 'test-id-2', name: 'Bob', lastUsed: Date.now() };
      const cookieData: UserData = { id: 'test-id-3', name: 'Charlie', lastUsed: Date.now() };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(localStorageData));
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(sessionStorageData));
      mockDocument.cookie = `quiz_world_user=${encodeURIComponent(JSON.stringify(cookieData))}`;

      const result = getUserData();
      expect(result).toEqual(localStorageData);
    });
  });

  describe('getUserName', () => {
    test('should return user name from storage', () => {
      const userData: UserData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));

      expect(getUserName()).toBe('Alice');
    });

    test('should return null when no user data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      expect(getUserName()).toBeNull();
    });

    test('should store and retrieve user name from localStorage', () => {
      const mockUserData = {
        id: 'test-id',
        name: 'Alice',
        lastUsed: Date.now(),
      };

      setUserName('Alice');
      
      // Check that localStorage.setItem was called with the correct structure
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'quiz_world_user',
        expect.stringMatching(/^{"id":"[^"]+","name":"Alice","lastUsed":\d+}$/)
      );

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockUserData));
      
      const retrievedName = getUserName();
      expect(retrievedName).toBe('Alice');
    });

    test('should store and retrieve user name from sessionStorage when localStorage fails', () => {
      const mockUserData = {
        id: 'test-id',
        name: 'Bob',
        lastUsed: Date.now(),
      };

      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      setUserName('Bob');
      
      // Check that sessionStorage.setItem was called with the correct structure
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'quiz_world_user',
        expect.stringMatching(/^{"id":"[^"]+","name":"Bob","lastUsed":\d+}$/)
      );

      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(mockUserData));
      
      const retrievedName = getUserName();
      expect(retrievedName).toBe('Bob');
    });

    test('should store and retrieve user name from cookie when other storage fails', () => {
      const mockUserData = {
        id: 'test-id',
        name: 'Charlie',
        lastUsed: Date.now(),
      };

      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('sessionStorage not available');
      });

      setUserName('Charlie');
      
      expect(document.cookie).toContain('quiz_world_user=');

      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(null);
      Object.defineProperty(document, 'cookie', {
        value: `quiz_world_user=${encodeURIComponent(JSON.stringify(mockUserData))}`,
        writable: true,
      });
      
      const retrievedName = getUserName();
      expect(retrievedName).toBe('Charlie');
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
      const userData: UserData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
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
      const userData: UserData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));
      mockSessionStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = '';

      expect(getStorageType()).toBe('localStorage');
    });

    test('should return sessionStorage when data exists there', () => {
      const userData: UserData = { id: 'test-id', name: 'Bob', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(null);
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(userData));
      mockDocument.cookie = '';

      expect(getStorageType()).toBe('sessionStorage');
    });

    test('should return cookie when data exists there', () => {
      const userData: UserData = { id: 'test-id', name: 'Charlie', lastUsed: Date.now() };
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
      const userData: UserData = { id: 'test-id', name: 'Alice', lastUsed: Date.now() };
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify(userData));

      migrateUserData('localStorage');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'quiz_world_user',
        JSON.stringify(userData)
      );
    });

    test('should migrate data to sessionStorage', () => {
      const userData: UserData = { id: 'test-id', name: 'Bob', lastUsed: Date.now() };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(userData));

      migrateUserData('sessionStorage');

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'quiz_world_user',
        JSON.stringify(userData)
      );
    });

    test('should migrate data to cookie', () => {
      const userData: UserData = { id: 'test-id', name: 'Charlie', lastUsed: Date.now() };
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

  describe('User ID Generation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Clear all storage
      clearUserData();
    });

    test('should generate user ID automatically when none exists', () => {
      const userId = getUserId();
      
      expect(userId).toBeDefined();
      expect(typeof userId).toBe('string');
      expect(userId.length).toBeGreaterThan(0);
    });

    test('should return same user ID on subsequent calls', () => {
      const userId1 = getUserId();
      const userId2 = getUserId();
      
      expect(userId1).toBe(userId2);
    });

    test('should generate different IDs for different sessions', () => {
      const userId1 = getUserId();
      clearUserData();
      const userId2 = getUserId();
      
      expect(userId1).not.toBe(userId2);
    });

    test('should persist user ID across storage types', () => {
      const userId = getUserId();
      
      // Clear localStorage but keep sessionStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('quiz_world_user');
      }
      
      const retrievedUserId = getUserId();
      expect(retrievedUserId).toBe(userId);
    });

    test('should set user ID with name', () => {
      const name = 'Test User';
      setUserWithId(name);
      
      const userId = getUserId();
      const userName = getUserName();
      
      expect(userId).toBeDefined();
      expect(userName).toBe(name);
    });
  });

  describe('User ID Persistence', () => {
    beforeEach(() => {
      // Reset cache and clear all storage before each test
      resetCache();
      if (typeof window !== 'undefined') {
        if (window.localStorage) {
          window.localStorage.removeItem('quiz_world_user');
        }
        if (window.sessionStorage) {
          window.sessionStorage.removeItem('quiz_world_user');
        }
      }
      if (typeof document !== 'undefined') {
        document.cookie = 'quiz_world_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
    });

    test('should return the same user ID on multiple calls', () => {
      // First call should generate and store a new ID
      const firstId = getUserId();
      expect(firstId).toBeTruthy();
      expect(typeof firstId).toBe('string');

      // Second call should return the same ID
      const secondId = getUserId();
      expect(secondId).toBe(firstId);

      // Third call should also return the same ID
      const thirdId = getUserId();
      expect(thirdId).toBe(firstId);
    });

    test('should persist user ID across page reloads (localStorage)', () => {
      // Mock localStorage to simulate persistence
      const mockStorage: Record<string, string> = {};
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
      };

      // Mock window.localStorage
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      // First call - should generate new ID
      const firstId = getUserId();
      expect(firstId).toBeTruthy();

      // Simulate page reload by clearing cache but keeping storage
      resetCache();

      // Second call - should return same ID from storage
      const secondId = getUserId();
      expect(secondId).toBe(firstId);
    });

    test('should maintain user ID when setting user name', () => {
      // Get initial user ID
      const initialId = getUserId();
      expect(initialId).toBeTruthy();

      // Set user name
      setUserName('Test User');

      // Get user ID again - should be the same
      const newId = getUserId();
      expect(newId).toBe(initialId);

      // Verify user data is correct
      const userData = getUserData();
      expect(userData?.id).toBe(initialId);
      expect(userData?.name).toBe('Test User');
    });

    test('should not generate new ID when user data already exists', () => {
      // Mock localStorage to work properly
      const mockStorage: Record<string, string> = {};
      const mockLocalStorage = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
      };

      // Mock window.localStorage
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });

      // Create initial user data
      const initialUserData = {
        id: 'existing_user_123',
        name: 'Existing User',
        lastUsed: Date.now(),
      };
      mockStorage['quiz_world_user'] = JSON.stringify(initialUserData);

      // Get user ID - should return existing ID
      const userId = getUserId();
      expect(userId).toBe('existing_user_123');

      // Get user ID again - should still return same ID
      const userId2 = getUserId();
      expect(userId2).toBe('existing_user_123');
    });
  });
}); 