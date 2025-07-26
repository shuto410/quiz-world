/**
 * Simple Debug User Switcher
 * 
 * SPECIFICATION:
 * - Provides quick user switching via URL parameters
 * - Shows current debug user status
 * - Allows opening new tabs with different users
 * 
 * KEY BEHAVIORS:
 * - Only visible in development mode
 * - Uses URL parameters for user switching
 * - Each tab maintains independent user identity
 * 
 * DEPENDENCIES:
 * - @/lib/userStorage for user management
 * - Next.js environment detection
 */

'use client';

import React, { useState, useEffect } from 'react';
import { createDebugUserUrl, isDebugUser, getStoredUserName, getStoredUserId } from '@/lib/userStorage';

const DEBUG_USERS = [
  { name: 'Alice', id: 'debug_alice' },
  { name: 'Bob', id: 'debug_bob' },
  { name: 'Carol', id: 'debug_carol' },
  { name: 'Dave', id: 'debug_dave' },
  { name: 'Emma', id: 'debug_emma' },
];

/**
 * Debug User Switcher Component
 */
export function DebugUser() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState('Anonymous');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isDebug, setIsDebug] = useState(false);
  
  // Prevent hydration mismatch by only rendering after client mount
  useEffect(() => {
    setMounted(true);
    setCurrentUser(getStoredUserName() || 'Anonymous');
    setCurrentId(getStoredUserId());
    setIsDebug(isDebugUser());
  }, []);
  
  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  // Don't render until mounted on client
  if (!mounted) {
    return null;
  }

  const openTabWithUser = (userName: string, userId: string) => {
    const url = createDebugUserUrl(userName, userId);
    window.open(url, '_blank');
  };

  const switchUser = (userName: string, userId: string) => {
    const url = createDebugUserUrl(userName, userId);
    window.location.href = url;
  };

  return (
    <div className="fixed top-4 left-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1 rounded text-sm font-bold shadow-lg border-2 transition-all duration-200 ${
          isDebug 
            ? 'bg-orange-500 text-white hover:bg-orange-600 border-orange-600 hover:shadow-orange-200' 
            : 'bg-slate-700 text-white hover:bg-slate-800 border-slate-800 hover:shadow-slate-300'
        }`}
      >
        🧪 {currentUser}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border-2 border-gray-400 rounded-lg shadow-xl p-4 min-w-[280px]">
          {/* Current Status */}
          <div className="mb-3 pb-3 border-b-2 border-gray-300">
            <div className="text-xs font-semibold text-gray-700 mb-1">Current User:</div>
            <div className="font-bold text-gray-900">{currentUser}</div>
            <div className="text-xs text-gray-600">ID: {currentId?.slice(-6) || 'none'}</div>
            {isDebug && (
              <div className="text-xs font-bold text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded">🧪 Debug Mode</div>
            )}
          </div>

          {/* Switch Current Tab */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">Switch Current Tab:</div>
            <div className="grid grid-cols-2 gap-1">
              {DEBUG_USERS.map((user) => (
                <button
                  key={user.id}
                  onClick={() => switchUser(user.name, user.id)}
                  className="px-2 py-1 text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 rounded shadow-sm transition-all duration-150 hover:shadow-md"
                >
                  {user.name}
                </button>
              ))}
            </div>
          </div>

          {/* Open New Tab */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">Open New Tab As:</div>
            <div className="grid grid-cols-2 gap-1">
              {DEBUG_USERS.map((user) => (
                <button
                  key={`new_${user.id}`}
                  onClick={() => openTabWithUser(user.name, user.id)}
                  className="px-2 py-1 text-xs font-medium bg-green-500 text-white hover:bg-green-600 rounded shadow-sm transition-all duration-150 hover:shadow-md"
                >
                  {user.name}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Debug */}
          <div className="pt-2 border-t-2 border-gray-300">
            <button
              onClick={() => {
                window.location.href = window.location.pathname;
              }}
              className="w-full px-2 py-1 text-xs font-medium bg-red-500 text-white hover:bg-red-600 rounded shadow-sm transition-all duration-150 hover:shadow-md"
            >
              Clear Debug Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}