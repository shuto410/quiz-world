/**
 * Refactored Room list component for Quiz World application
 * - Uses custom hooks for better separation of concerns
 * - Split into smaller, focused components
 * - Maintains anime pop style design
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { Room, User } from '@/types';
import { useSocketConnection } from '../hooks/useSocketConnection';
import { useRoomList } from '../hooks/useRoomList';
import { joinRoom, createRoom } from '@/lib/socketClient';
import { getUserName, setUserName, getUserId } from '@/lib/userStorage';

/**
 * Room card component
 */
interface RoomCardProps {
  room: Room;
  onJoin: (room: Room) => void;
}

function RoomCard({ room, onJoin }: RoomCardProps) {
  const isFull = room.users.length >= room.maxPlayers;
  const hostName = room.users.find(u => u.id === room.hostId)?.name || 'Unknown';

  return (
    <Card variant="elevated" className="cursor-pointer">
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
            Host: {hostName}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => onJoin(room)}
          disabled={isFull}
          className="w-full"
        >
          {isFull ? 'Full' : 'Join Room'}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Create room modal component
 */
interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (name: string, isPublic: boolean, maxPlayers: number, userName: string) => void;
  initialUserName: string;
}

function CreateRoomModal({ isOpen, onClose, onCreateRoom, initialUserName }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [userName, setUserNameState] = useState(initialUserName);

  const handleSubmit = () => {
    if (name.trim() && userName.trim()) {
      onCreateRoom(name, isPublic, maxPlayers, userName);
      // Reset form
      setName('');
      setIsPublic(true);
      setMaxPlayers(8);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            placeholder="Enter room name..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Players
          </label>
          <select
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
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
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !userName.trim()}>
            Create Room
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Join room modal component
 */
interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (userName: string) => void;
  roomName: string;
  initialUserName: string;
}

function JoinRoomModal({ isOpen, onClose, onJoinRoom, roomName, initialUserName }: JoinRoomModalProps) {
  const [userName, setUserNameState] = useState(initialUserName);

  const handleSubmit = () => {
    if (userName.trim()) {
      onJoinRoom(userName);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Join ${roomName}`}
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!userName.trim()}>
            Join Room
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Empty state component
 */
interface EmptyStateProps {
  onCreateRoom: () => void;
}

function EmptyState({ onCreateRoom }: EmptyStateProps) {
  return (
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
          <Button onClick={onCreateRoom}>
            Create First Room
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Room list props interface
 */
export interface RoomListProps {
  onRoomJoined?: (room: Room) => void;
  className?: string;
}

/**
 * Refactored Room list component
 */
export function RoomList({ onRoomJoined, className }: RoomListProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [userName, setUserNameState] = useState('');

  // Use custom hooks
  const { isConnected, connectionState } = useSocketConnection({
    serverUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002',
    autoConnect: true,
         onRoomCreated: (data: { room: Room }) => {
       console.log('Room created:', data.room.id);
       setShowCreateModal(false);
       
       // Store room data for the room page
       if (typeof window !== 'undefined') {
         sessionStorage.setItem('createdRoom', JSON.stringify(data.room));
       }
       
       // Navigate to room as host
       router.push(`/room/${data.room.id}?host=true`);
     },
     onRoomJoined: (data: { room: Room; user: User }) => {
       console.log('Room joined:', data.room.id);
       
       // Handle non-host joins
       if (!data.user?.isHost) {
         onRoomJoined?.(data.room);
         router.push(`/room/${data.room.id}`);
       }
     },
  });

  const { rooms, loading, error, refresh } = useRoomList(isConnected, {
    autoFetch: true,
    filter: (room) => room.isPublic,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  // Load saved user name on mount
  useEffect(() => {
    const savedUserName = getUserName();
    if (savedUserName) {
      setUserNameState(savedUserName);
    }
  }, []);

  // Handle room creation
  const handleCreateRoom = (name: string, isPublic: boolean, maxPlayers: number, userName: string) => {
    setUserNameState(userName);
    setUserName(userName);
    const userId = getUserId();
    createRoom(name, isPublic, maxPlayers, userName, userId);
  };

  // Handle room join
  const handleJoinRoom = (userName: string) => {
    if (!selectedRoom) return;
    
    setUserNameState(userName);
    setUserName(userName);
    const userId = getUserId();
    
    joinRoom(selectedRoom.id, userId, userName);
    setShowJoinModal(false);
    setSelectedRoom(null);
  };

  // Open join modal for a room
  const openJoinModal = (room: Room) => {
    setSelectedRoom(room);
    setShowJoinModal(true);
  };

  // Show loading state while connecting
  if (connectionState === 'connecting') {
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

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
          Quiz World
        </h1>
        <Button onClick={() => setShowCreateModal(true)} disabled={!isConnected}>
          Create Room
        </Button>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
            <span className="text-sm text-yellow-800">
              {connectionState === 'disconnected' && 'Disconnected from server'}
              {connectionState === 'error' && 'Connection error'}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm text-red-800">{error}</span>
        </div>
      )}

      {/* Room List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Public Rooms</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refresh} 
            loading={loading}
            disabled={!isConnected}
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
          <EmptyState onCreateRoom={() => setShowCreateModal(true)} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onJoin={openJoinModal} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateRoom={handleCreateRoom}
        initialUserName={userName}
      />

      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoinRoom={handleJoinRoom}
        roomName={selectedRoom?.name || ''}
        initialUserName={userName}
      />
    </div>
  );
}