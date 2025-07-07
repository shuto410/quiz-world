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
import { getUserName, getUserId } from '@/lib/userStorage';
import { getSocket, isConnected, joinRoom, leaveRoom } from '@/lib/socketClient';

/**
 * Room page component
 */
export default function RoomPage() {
  const [room, setRoom] = useState<RoomType | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasJoinedRef = useRef(false);
  const router = useRouter();
  const resolvedParams = useParams();
  const roomId = resolvedParams.id as string;
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  // Initialize socket and check if already in room
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

    const userId = getUserId();

    // Get isHost value from URL params (fallback for initial load)
    const isHostValue = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('host') === 'true' : false;
    
    // Check if this is a fresh room creation by looking for stored room data
    const storedRoomData = typeof window !== 'undefined' ? sessionStorage.getItem('createdRoom') : null;
    const isFreshRoomCreation = isHostValue && storedRoomData && !hasJoinedRef.current;
    
    // If we have stored room data, use it immediately
    if (storedRoomData && isHostValue) {
      try {
        const roomData = JSON.parse(storedRoomData);
        if (roomData.id === roomId) {
          console.log('Using stored room data for fresh room creation:', { roomId: roomData.id, hostName: roomData.users[0]?.name });
          setRoom(roomData);
          setCurrentUser(roomData.users[0]);
          setLoading(false);
          hasJoinedRef.current = true;
          
          // Clear stored data after using it
          sessionStorage.removeItem('createdRoom');
        }
      } catch (error) {
        console.error('Error parsing stored room data:', error);
        sessionStorage.removeItem('createdRoom');
      }
    }

    // room:joined handler
    const handleRoomJoined = (data: { room: RoomType; user: User }) => {
      console.log('Received room:joined event:', { roomId: data.room.id, userId: data.user.id, userName: data.user.name, isHost: data.user.isHost });
      setRoom(data.room);
      setCurrentUser(data.user);
      setLoading(false);
      hasJoinedRef.current = true;
    };

    // room:userJoined handler
    const handleUserJoined = (data: { user: User }) => {
      setRoom(prev => prev ? { ...prev, users: [...prev.users, data.user] } : prev);
    };

    // room:userLeft handler
    const handleUserLeft = (data: { userId: string }) => {
      setRoom(prev => prev ? { ...prev, users: prev.users.filter(u => u.id !== data.userId) } : prev);
    };

    // room:updated handler
    const handleRoomUpdated = (data: { room: RoomType }) => {
      setRoom(data.room);
    };

    // room:notFound handler
    const handleRoomNotFound = () => {
      setError('Room not found');
      setLoading(false);
    };

    // room:alreadyJoined handler (user is already in the room)
    const handleAlreadyJoined = (data: { room: RoomType; user: User }) => {
      setRoom(data.room);
      setCurrentUser(data.user);
      setLoading(false);
      hasJoinedRef.current = true;
    };

    socket.on('room:joined', handleRoomJoined);
    socket.on('room:alreadyJoined', handleAlreadyJoined);
    socket.on('room:userJoined', handleUserJoined);
    socket.on('room:userLeft', handleUserLeft);
    socket.on('room:updated', handleRoomUpdated);
    socket.on('room:notFound', handleRoomNotFound);

    // If user is already host (from room creation), don't call joinRoom
    // The server should send room:joined event automatically for room creation
    console.log('=== Room Page Debug ===');
    console.log('isHost from URL:', isHostValue);
    console.log('hasJoinedRef.current:', hasJoinedRef.current);
    console.log('userId:', userId);
    console.log('userName:', userName);
    console.log('roomId:', roomId);
    
    if (isHostValue) {
      console.log('User is host - waiting for room:joined event from room creation');
      // Don't call joinRoom for host users - they should receive room:joined from room creation
      // The server will send room:joined event automatically for room creation
    } else if (!hasJoinedRef.current) {
      console.log('Calling joinRoom...');
      joinRoom(roomId, userId, userName);
    } else {
      console.log('Skipping joinRoom - already joined');
    }
    console.log('=== End Debug ===');

    // Clean up on unmount
    return () => {
      socket.off('room:joined', handleRoomJoined);
      socket.off('room:alreadyJoined', handleAlreadyJoined);
      socket.off('room:userJoined', handleUserJoined);
      socket.off('room:userLeft', handleUserLeft);
      socket.off('room:updated', handleRoomUpdated);
      socket.off('room:notFound', handleRoomNotFound);
      
      // Don't leave room if this is a fresh room creation (to avoid leaving immediately after creation)
      if (!isFreshRoomCreation) {
        leaveRoom();
      }
    };
  }, [roomId, router]); // Remove isHost from dependencies to prevent re-execution

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