/**
 * Room Header component for Quiz World application
 * - Displays room name, player count, and visibility
 * - Shows Manage Quizzes button for host users
 * - Provides Leave Room functionality
 */

import React from 'react';
import { Button } from '@/components/ui/Button';
import type { Room } from '@/types';

/**
 * Room header component props
 */
interface RoomHeaderProps {
  room: Room;
  isHost: boolean;
  onManageQuizzes: () => void;
  onLeave: () => void;
}

/**
 * Room header component
 */
export function RoomHeader({ room, isHost, onManageQuizzes, onLeave }: RoomHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="room-name">{room.name}</h1>
        <p className="text-gray-600">
          {room.users.length}/{room.maxPlayers} players
          {room.isPublic && ' • Public Room'}
        </p>
      </div>
      <div className="flex gap-2">
        {isHost && (
          <Button variant="secondary" onClick={onManageQuizzes}>
            Manage Quizzes
          </Button>
        )}
        <Button variant="danger" onClick={onLeave}>
          Leave Room
        </Button>
      </div>
    </div>
  );
} 