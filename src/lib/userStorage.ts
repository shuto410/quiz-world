/**
 * User storage utilities for Quiz World application
 * - Manages user name storage in cookies and localStorage
 * - Provides fallback mechanisms for different storage types
 * - Handles storage expiration and cleanup
 */

/**
 * Storage types supported by the application
 */
export type StorageType = 'cookie' | 'localStorage' | 'sessionStorage';

/**
 * User data structure
 */
export interface UserData {
  id: string;
  name: string;
  lastUsed: number;
}


/**
 * Storage configuration
 */
const STORAGE_CONFIG = {
  COOKIE_NAME: 'quiz_world_user',
  LOCAL_STORAGE_KEY: 'quiz_world_user',
  SESSION_STORAGE_KEY: 'quiz_world_user',
  COOKIE_EXPIRES_DAYS: 30,
} as const;

/**
 * In-memory cache for user data to avoid repeated storage access
 */
let userDataCache: UserData | null = null;
let cacheInitialized = false;

/**
 * Get user data from cookies
 * @returns User data or null if not found
 */
function getUserFromCookie(): UserData | null {
  try {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    const userCookie = cookies.find(cookie => 
      cookie.trim().startsWith(`${STORAGE_CONFIG.COOKIE_NAME}=`)
    );
    
    if (!userCookie) return null;
    
    const value = userCookie.split('=')[1];
    const decoded = decodeURIComponent(value);
    return JSON.parse(decoded);
  } catch {
    // Failed to read user from cookie
    return null;
  }
}

/**
 * Set user data in cookies
 * @param userData - User data to store
 */
function setUserInCookie(userData: UserData): void {
  try {
    if (typeof document === 'undefined') return;
    
    const expires = new Date();
    expires.setDate(expires.getDate() + STORAGE_CONFIG.COOKIE_EXPIRES_DAYS);
    
    const value = JSON.stringify(userData);
    const encoded = encodeURIComponent(value);
    
    document.cookie = `${STORAGE_CONFIG.COOKIE_NAME}=${encoded}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  } catch {
    // Failed to set user in cookie
  }
}

/**
 * Get user data from localStorage
 * @returns User data or null if not found
 */
function getUserFromLocalStorage(): UserData | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    
    const stored = window.localStorage.getItem(STORAGE_CONFIG.LOCAL_STORAGE_KEY);
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch {
    // Failed to read user from localStorage
    return null;
  }
}

/**
 * Set user data in localStorage
 * @param userData - User data to store
 */
function setUserInLocalStorage(userData: UserData): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    
    window.localStorage.setItem(STORAGE_CONFIG.LOCAL_STORAGE_KEY, JSON.stringify(userData));
  } catch {
    // Failed to set user in localStorage
  }
}

/**
 * Get user data from sessionStorage
 * @returns User data or null if not found
 */
function getUserFromSessionStorage(): UserData | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    
    const stored = window.sessionStorage.getItem(STORAGE_CONFIG.SESSION_STORAGE_KEY);
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch {
    // Failed to read user from sessionStorage
    return null;
  }
}

/**
 * Set user data in sessionStorage
 * @param userData - User data to store
 */
function setUserInSessionStorage(userData: UserData): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    
    window.sessionStorage.setItem(STORAGE_CONFIG.SESSION_STORAGE_KEY, JSON.stringify(userData));
  } catch {
    // Failed to set user in sessionStorage
  }
}

/**
 * Get debug user data from URL parameters
 * Format: ?debug_user=name&debug_id=id
 * Priority: URL parameters override all other storage
 */
function getDebugUserFromURL(): UserData | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const debugUser = urlParams.get('debug_user');
    const debugId = urlParams.get('debug_id');

    if (debugUser) {
      return {
        id: debugId || `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: debugUser,
        lastUsed: Date.now(),
      };
    }
  } catch {
    // Ignore URL parsing errors
  }

  return null;
}

/**
 * Get user data with fallback mechanism
 * Priority: URL debug params → localStorage → sessionStorage → cookie → null
 * @returns User data or null if not found
 */
export function getUserData(): UserData | null {
  // Check for debug user in URL first (highest priority)
  const debugData = getDebugUserFromURL();
  if (debugData) {
    return debugData;
  }

  // Return cached data if available and valid
  if (cacheInitialized && userDataCache && userDataCache.id) {
    return userDataCache;
  }
  
  // Try to get data from localStorage
  let userData = getUserFromLocalStorage();
  
  if (userData) {
    // Check if user data has ID, if not, it's old format
    if (!userData.id) {
      userData = {
        id: generateUserId(),
        name: userData.name || '',
        lastUsed: userData.lastUsed || Date.now(),
      };
      // Update storage with new format
      setUserInLocalStorage(userData);
    }
    
    userDataCache = userData;
    cacheInitialized = true;
    return userData;
  }
  
  // Try to get data from sessionStorage
  userData = getUserFromSessionStorage();
  
  if (userData) {
    // Check if user data has ID, if not, it's old format
    if (!userData.id) {
      userData = {
        id: generateUserId(),
        name: userData.name || '',
        lastUsed: userData.lastUsed || Date.now(),
      };
      // Update storage with new format
      setUserInSessionStorage(userData);
    }
    
    userDataCache = userData;
    cacheInitialized = true;
    return userData;
  }
  
  // Try to get data from cookie
  userData = getUserFromCookie();
  
  if (userData) {
    // Check if user data has ID, if not, it's old format
    if (!userData.id) {
      userData = {
        id: generateUserId(),
        name: userData.name || '',
        lastUsed: userData.lastUsed || Date.now(),
      };
      // Update storage with new format
      setUserInCookie(userData);
    }
    
    userDataCache = userData;
    cacheInitialized = true;
    return userData;
  }
  
  cacheInitialized = true;
  return null;
}

/**
 * Get user name with fallback mechanism
 * @returns User name or null if not found
 */
export function getUserName(): string | null {
  const userData = getUserData();
  return userData?.name || null;
}

/**
 * Generate a unique user ID
 * @returns A unique user ID string
 */
function generateUserId(): string {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get user ID with automatic generation if needed
 * @returns User ID string
 */
export function getUserId(): string {
  // Return cached ID if available and valid
  if (cacheInitialized && userDataCache && userDataCache.id) {
    return userDataCache.id;
  }
  
  let userData = getUserData();
  
  // If no user data exists or user data doesn't have ID, generate new user with ID
  if (!userData || !userData.id) {
    const newId = generateUserId();
    
    // If we have existing user data without ID, preserve the name
    const existingName = userData?.name || '';
    
    userData = {
      id: newId,
      name: existingName,
      lastUsed: Date.now(),
    };
    
    // Update cache
    userDataCache = userData;
    cacheInitialized = true;
    
    // Store in all available storage types
    setUserInLocalStorage(userData);
    setUserInSessionStorage(userData);
    setUserInCookie(userData);
  } else {
    // Update lastUsed timestamp for existing user
    const updatedUserData = {
      ...userData,
      lastUsed: Date.now(),
    };
    
    // Update cache
    userDataCache = updatedUserData;
    
    // Update storage with new timestamp
    setUserInLocalStorage(updatedUserData);
    setUserInSessionStorage(updatedUserData);
    setUserInCookie(updatedUserData);
  }
  
  return userData.id;
}

/**
 * Set user data with ID and name
 * @param name - User name to store
 */
export function setUserWithId(name: string): void {
  let userData = getUserData();
  
  // If no user data exists, generate new ID
  if (!userData) {
    userData = {
      id: generateUserId(),
      name,
      lastUsed: Date.now(),
    };
  } else {
    // Update existing user data
    userData = {
      ...userData,
      name,
      lastUsed: Date.now(),
    };
  }
  
  // Update cache immediately and mark as initialized
  userDataCache = userData;
  cacheInitialized = true;
  
  // Store in all available storage types
  setUserInLocalStorage(userData);
  setUserInSessionStorage(userData);
  setUserInCookie(userData);
}

/**
 * Set user data with fallback mechanism
 * Stores in all available storage types for redundancy
 * @param name - User name to store
 */
export function setUserName(name: string): void {
  setUserWithId(name);
}

/**
 * Clear user data from all storage types
 */
export function clearUserData(): void {
  try {
    // Clear cache
    userDataCache = null;
    cacheInitialized = false;
    
    // Clear localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_CONFIG.LOCAL_STORAGE_KEY);
    }
    
    // Clear sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(STORAGE_CONFIG.SESSION_STORAGE_KEY);
    }
    
    // Clear cookie
    if (typeof document !== 'undefined') {
      document.cookie = `${STORAGE_CONFIG.COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
    
  } catch {
    // Failed to clear user data
  }
}

/**
 * Reset cache for testing purposes
 */
export function resetCache(): void {
  userDataCache = null;
  cacheInitialized = false;
}

/**
 * Create a debug URL with user parameters
 * @param userName - Debug user name
 * @param userId - Optional debug user ID
 * @param path - Optional path (defaults to current path)
 * @returns URL with debug parameters
 */
export function createDebugUserUrl(userName: string, userId?: string, path?: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.origin + (path || window.location.pathname));
  url.searchParams.set('debug_user', userName);
  if (userId) {
    url.searchParams.set('debug_id', userId);
  }
  return url.toString();
}

/**
 * Check if current page is using debug user parameters
 * @returns true if debug parameters are present
 */
export function isDebugUser(): boolean {
  return getDebugUserFromURL() !== null;
}

/**
 * Check if user data exists in any storage
 * @returns True if user data exists, false otherwise
 */
export function hasUserData(): boolean {
  return getUserData() !== null;
}

/**
 * Get the storage type where user data is currently stored
 * @returns Storage type or null if not found
 */
export function getStorageType(): StorageType | null {
  if (getUserFromLocalStorage()) return 'localStorage';
  if (getUserFromSessionStorage()) return 'sessionStorage';
  if (getUserFromCookie()) return 'cookie';
  return null;
}

/**
 * Migrate user data to a specific storage type
 * @param targetStorage - Target storage type
 */
export function migrateUserData(targetStorage: StorageType): void {
  const userData = getUserData();
  if (!userData) return;
  
  switch (targetStorage) {
    case 'localStorage':
      setUserInLocalStorage(userData);
      break;
    case 'sessionStorage':
      setUserInSessionStorage(userData);
      break;
    case 'cookie':
      setUserInCookie(userData);
      break;
  }
}

/**
 * Get storage availability status
 * @returns Object with availability status for each storage type
 */
export function getStorageAvailability(): Record<StorageType, boolean> {
  return {
    localStorage: typeof window !== 'undefined' && !!window.localStorage,
    sessionStorage: typeof window !== 'undefined' && !!window.sessionStorage,
    cookie: typeof document !== 'undefined' && !!document.cookie,
  };
}

 