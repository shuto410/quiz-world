/**
 * Room list component for Quiz World application
 * - Displays public rooms with join functionality
 * - Includes room creation modal
 * - Shows room status and player count
 * - Follows anime pop style design
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import type { Room } from '../types';
import { 
  requestRoomList, 
  joinRoom, 
  createRoom, 
  initializeSocketClient,
  type ConnectionState
} from '../lib/socketClient';
import { getUserName, setUserName, getUserId, getUserData, resetCache } from '../lib/userStorage';

/**
 * Room list props interface
 */
export interface RoomListProps {
  onRoomJoined?: (room: Room) => void;
  className?: string;
}

/**
 * Create room form data interface
 */
interface CreateRoomForm {
  name: string;
  isPublic: boolean;
  maxPlayers: number;
}

/**
 * Room list component with anime pop style
 */
export function RoomList({ onRoomJoined, className }: RoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [userName, setUserNameState] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [createForm, setCreateForm] = useState<CreateRoomForm>({
    name: '',
    isPublic: true,
    maxPlayers: 8,
  });
  const router = useRouter();

  // Initialize socket client and load user name on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Reset cache to clear old format data
        resetCache();
        
        // Load user name first
        const savedUserName = getUserName();
        if (savedUserName) {
          setUserNameState(savedUserName);
        }
        
        // Get server URL from environment or use default
        const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        
        // Initialize socket client only when needed
        await initializeSocketClient(serverUrl, {
          onRoomList: (data) => {
            setRooms(data.rooms);
            setLoading(false);
          },
          onRoomCreated: (data) => {
            console.log('Room created event received:', { roomId: data.room.id, hostName: data.room.users[0]?.name, isHost: data.room.users[0]?.isHost });
            setRooms(prev => [...prev, data.room]);
            setShowCreateModal(false);
            setCreateForm({ name: '', isPublic: true, maxPlayers: 8 });
            
            // Store room data in sessionStorage for the room page to access
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('createdRoom', JSON.stringify(data.room));
            }
            
            // Navigate to room page with host flag
            router.push(`/room/${data.room.id}?host=true`);
          },
          onRoomJoined: (data) => {
            // Only handle room:joined for joining existing rooms, not for room creation
            // Room creation uses onRoomCreated instead
            console.log('Room joined event received:', { roomId: data.room.id, isHost: data.user?.isHost });
            
            // If this is a host user (from room creation), don't navigate here
            // The navigation will be handled by onRoomCreated
            if (!data.user?.isHost) {
              onRoomJoined?.(data.room);
              router.push(`/room/${data.room.id}`);
            } else {
              console.log('Ignoring room:joined for host user (room creation)');
            }
          },
          onConnectionStateChange: (state) => {
            setConnectionState(state);
          },
        });
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    // Only initialize when component is actually mounted and visible
    const timer = setTimeout(() => {
      initializeApp();
    }, 100); // Small delay to avoid immediate connection on page load

    return () => clearTimeout(timer);
  }, [onRoomJoined]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load rooms when connected
  useEffect(() => {
    if (connectionState === 'connected') {
      loadRooms();
    }
  }, [connectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show loading state while not connected
  if (connectionState !== 'connected') {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Quiz World
          </h1>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Connecting to server...</p>
        </div>
      </div>
    );
  }

  /**
   * Load public rooms from server
   */
  const loadRooms = () => {
    if (connectionState !== 'connected') {
      console.warn('Socket not connected, cannot load rooms');
      return;
    }
    
    setLoading(true);
    try {
      requestRoomList();
    } catch (error) {
      console.error('Failed to request room list:', error);
      setLoading(false);
    }
  };

  /**
   * Handle room creation
   */
  const handleCreateRoom = () => {
    if (!createForm.name.trim() || !userName.trim()) return;
    // ユーザー名を保存
    setUserNameState(userName);
    setUserName(userName);
    // ユーザーIDを生成・保存
    const userId = getUserId();
    createRoom(createForm.name, createForm.isPublic, createForm.maxPlayers, userName, userId);
    setShowCreateModal(false);
    setCreateForm({ name: '', isPublic: true, maxPlayers: 8 });
  };

  /**
   * Handle room join
   */
  const handleJoinRoom = () => {
    if (!selectedRoom || !userName.trim()) return;
    
    console.log('=== Room Join Debug ===');
    console.log('Selected room:', selectedRoom);
    console.log('User name:', userName);
    
    // Check current user data before setting name
    const currentUserData = getUserData();
    console.log('Current user data before setUserName:', currentUserData);
    
    // Set user name first (this will preserve existing user ID or create new one)
    setUserNameState(userName);
    setUserName(userName);
    
    // Check user data after setting name
    const updatedUserData = getUserData();
    console.log('Updated user data after setUserName:', updatedUserData);
    
    // Get user ID after setting name
    const userId = getUserId();
    console.log('Final user ID from getUserId():', userId);
    
    console.log('Joining room with:', { roomId: selectedRoom.id, userId, userName });
    console.log('=== End Debug ===');
    
    joinRoom(selectedRoom.id, userId, userName);
    setShowJoinModal(false);
    setSelectedRoom(null);
    onRoomJoined?.(selectedRoom);
    // Navigate to room page
    router.push(`/room/${selectedRoom.id}`);
  };

  /**
   * Open join modal for a room
   */
  const openJoinModal = (room: Room) => {
    setSelectedRoom(room);
    setShowJoinModal(true);
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          Quiz World
        </h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Create Room
        </Button>
      </div>

      {/* Connection Status */}
      {connectionState !== 'connected' && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
            <span className="text-sm text-yellow-800">
              {connectionState === 'connecting' && 'Connecting to server...'}
              {connectionState === 'disconnected' && 'Disconnected from server'}
              {connectionState === 'error' && 'Connection error'}
            </span>
          </div>
        </div>
      )}

      {/* Room List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Public Rooms</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={loadRooms} 
            loading={loading}
            disabled={connectionState !== 'connected'}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading rooms...</p>
          </div>
        ) : rooms.length === 0 ? (
          <Card variant="gradient">
            <CardContent>
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🎮</div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  No rooms available
                </h3>
                <p className="text-gray-600 mb-4">
                  Be the first to create a room and start playing!
                </p>
                <Button onClick={() => setShowCreateModal(true)}>
                  Create First Room
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <Card key={room.id} variant="elevated" className="cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {room.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      room.isPublic 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {room.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-2">👥</span>
                      {room.users.length}/{room.maxPlayers} players
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-2">🎯</span>
                      {room.quizzes.length} quizzes
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-2">👑</span>
                      Host: {room.users.find(u => u.id === room.hostId)?.name || 'Unknown'}
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={() => openJoinModal(room)}
                    disabled={room.users.length >= room.maxPlayers}
                    className="w-full"
                  >
                    {room.users.length >= room.maxPlayers ? 'Full' : 'Join Room'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Room"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Name
            </label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter room name..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Players
            </label>
            <select
              value={createForm.maxPlayers}
              onChange={(e) => setCreateForm(prev => ({ ...prev, maxPlayers: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            >
              {[2, 4, 6, 8].map(num => (
                <option key={num} value={num}>{num} players</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPublic"
              checked={createForm.isPublic}
              onChange={(e) => setCreateForm(prev => ({ ...prev, isPublic: e.target.checked }))}
              className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
            />
            <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
              Public room (visible to everyone)
            </label>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserNameState(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter your name..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRoom} disabled={!createForm.name.trim() || !userName.trim()}>
              Create Room
            </Button>
          </div>
        </div>
      </Modal>

      {/* Join Room Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title={`Join ${selectedRoom?.name}`}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserNameState(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="Enter your name..."
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowJoinModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleJoinRoom} disabled={!userName.trim()}>
              Join Room
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
} 