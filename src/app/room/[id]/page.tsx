/**
 * Room page component for Quiz World application
 * - Displays room information and user list
 * - Shows chat messages and real-time updates
 * - Provides host controls for quiz management
 * - Handles room joining and navigation
 * - Syncs room state with Socket.io server
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Room } from '@/components/Room';
import type { Room as RoomType, User } from '@/types';
import { getUserName } from '@/lib/userStorage';
import { getSocket, isConnected, joinRoom, leaveRoom } from '@/lib/socketClient';

/**
 * Room page component
 */
export default function RoomPage() {
  const [room, setRoom] = useState<RoomType | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const resolvedParams = useParams();
  const roomId = resolvedParams.id as string;
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  // Join room on mount
  useEffect(() => {
    const userName = getUserName();
    if (!userName) {
      router.push('/');
      return;
    }
    if (!isConnected()) {
      setError('Not connected to server. Please refresh the page.');
      setLoading(false);
      return;
    }
    const socket = getSocket();
    socketRef.current = socket;
    if (!socket) {
      setError('Socket not initialized');
      setLoading(false);
      return;
    }

    // Join room
    joinRoom(roomId, userName);

    // room:joined handler
    const handleRoomJoined = (data: { room: RoomType; user: User }) => {
      setRoom(data.room);
      setCurrentUser(data.user);
      setLoading(false);
    };
    // user joined handler
    const handleUserJoined = (data: { user: User }) => {
      setRoom(prev => prev ? { ...prev, users: [...prev.users, data.user] } : prev);
    };
    // user left handler
    const handleUserLeft = (data: { userId: string }) => {
      setRoom(prev => prev ? { ...prev, users: prev.users.filter(u => u.id !== data.userId) } : prev);
    };
    // room updated handler
    const handleRoomUpdated = (data: { room: RoomType }) => {
      setRoom(data.room);
    };

    socket.on('room:joined', handleRoomJoined);
    socket.on('room:userJoined', handleUserJoined);
    socket.on('room:userLeft', handleUserLeft);
    socket.on('room:updated', handleRoomUpdated);

    // Clean up on unmount
    return () => {
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:userJoined', handleUserJoined);
      socket.off('room:userLeft', handleUserLeft);
      socket.off('room:updated', handleRoomUpdated);
      leaveRoom();
    };
  }, [roomId, router]);

  // Handle room leave
  const handleRoomLeave = () => {
    leaveRoom();
    router.push('/');
  };

  // Handle quiz start
  const handleQuizStart = (quiz: unknown) => {
    // TODO: Navigate to quiz game page
    console.log('Starting quiz:', quiz);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 ease-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg hover:from-pink-600 hover:to-purple-700 focus:ring-pink-500 border border-pink-400 px-4 py-2 text-base"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!room || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Room not found</h2>
          <p className="text-gray-600 mb-4">The room you&apos;re looking for doesn&apos;t exist.</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 ease-out transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg hover:from-pink-600 hover:to-purple-700 focus:ring-pink-500 border border-pink-400 px-4 py-2 text-base"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <Room
          room={room}
          currentUser={currentUser}
          onLeave={handleRoomLeave}
          onQuizStart={handleQuizStart}
        />
      </div>
    </div>
  );
} 