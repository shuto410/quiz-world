/**
 * Player List component for Quiz World application
 * - Displays list of players in the room
 * - Shows host crown and current user indicator
 * - Provides Make Host functionality for host users
 */

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { User } from '@/types';

/**
 * Player list component props
 */
interface PlayerListProps {
  users: User[];
  currentUserId: string;
  isHost: boolean;
  onMakeHost: (user: User) => void;
}

/**
 * Individual player item props
 */
interface PlayerItemProps {
  user: User;
  isCurrentUser: boolean;
  canMakeHost: boolean;
  onMakeHost: () => void;
}

/**
 * Individual player item component
 */
function PlayerItem({ user, isCurrentUser, canMakeHost, onMakeHost }: PlayerItemProps) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
        isCurrentUser
          ? 'bg-pink-100 border border-pink-200'
          : 'bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {user.isHost ? '👑' : '👤'}
          </span>
          <span className="font-medium text-gray-800">
            {user.name}
          </span>
        </div>
        {isCurrentUser && (
          <span className="text-xs bg-pink-200 text-pink-800 px-2 py-1 rounded-full">
            You
          </span>
        )}
      </div>
      {canMakeHost && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onMakeHost}
        >
          Make Host
        </Button>
      )}
    </div>
  );
}

/**
 * Player list component
 */
export function PlayerList({ users, currentUserId, isHost, onMakeHost }: PlayerListProps) {
  return (
    <Card variant="elevated">
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-800">Players</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {users.map((user) => (
            <PlayerItem
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUserId}
              canMakeHost={isHost && !user.isHost}
              onMakeHost={() => onMakeHost(user)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 