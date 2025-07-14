/**
 * Player List component for Quiz World application
 * - Displays list of players in the room
 * - Shows host crown and current user indicator
 * - Displays buzz order, answers, and scores for each player
 * - Provides Make Host functionality for host users
 */

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import type { User, Score } from '@/types';

/**
 * Player status information for quiz game
 */
interface PlayerStatus {
  userId: string;
  buzzOrder?: number;
  answer?: string;
  score?: number;
  isAnswering?: boolean;
  isJudged?: boolean;
  isCorrect?: boolean;
}

/**
 * Player judgment result for tracking answers
 */
interface PlayerJudgment {
  userId: string;
  answer: string;
  isCorrect: boolean;
  timestamp: number;
}

/**
 * Player list component props
 */
interface PlayerListProps {
  users: User[];
  currentUserId: string;
  scores?: Score[];
  buzzedUsers?: User[];
  buzzedUser?: User | null;
  answer?: string;
  hasAnswered?: boolean;
  recentJudgments?: PlayerJudgment[];
}

/**
 * Individual player item props
 */
interface PlayerItemProps {
  user: User;
  isCurrentUser: boolean;
  status: PlayerStatus;
}

/**
 * Individual player item component - improved design with better spacing
 */
function PlayerItem({ user, isCurrentUser, status }: PlayerItemProps) {
  return (
    <div
      className={`p-4 rounded-lg border transition-all duration-200 ${
        isCurrentUser
          ? 'bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 shadow-sm'
          : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Main player info row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">
              {user.isHost ? '👑' : '👤'}
            </span>
            <span className="font-semibold text-gray-800 text-lg">
              {user.name}
            </span>
          </div>
          {isCurrentUser && (
            <span className="text-xs bg-pink-200 text-pink-800 px-2 py-1 rounded-full font-medium">
              You
            </span>
          )}
        </div>
      </div>
      
      {/* Status information row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Buzz Order */}
          {status.buzzOrder && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full border border-yellow-200 font-medium">
              🔔 #{status.buzzOrder}
            </span>
          )}
          
          {/* Current Answering Status */}
          {status.isAnswering && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full border border-blue-200 font-medium animate-pulse">
              ✏️ Answering
            </span>
          )}
          
          {/* Judgment Result */}
          {status.isJudged && (
            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${
              status.isCorrect 
                ? 'bg-green-100 text-green-800 border-green-200' 
                : 'bg-red-100 text-red-800 border-red-200'
            }`}>
              {status.isCorrect ? '✅ Correct' : '❌ Incorrect'}
            </span>
          )}
        </div>
        
        {/* Score */}
        {status.score !== undefined && status.score > 0 && (
          <span className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full border border-purple-200 font-semibold">
            {status.score}pts
          </span>
        )}
      </div>
      
      {/* Answer display row - full width for better readability */}
      {status.answer && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Answer:</div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-gray-800 break-words">
              &quot;{status.answer}&quot;
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Player list component
 */
export function PlayerList({ 
  users, 
  currentUserId, 
  scores = [], 
  buzzedUsers = [], 
  buzzedUser = null, 
  answer = '', 
  hasAnswered = false, 
  recentJudgments = []
}: PlayerListProps) {
  
  // Create player status map
  const getPlayerStatus = (user: User): PlayerStatus => {
    const status: PlayerStatus = { userId: user.id };
    
    // Find buzz order
    const buzzIndex = buzzedUsers.findIndex(buzzedUser => buzzedUser.id === user.id);
    if (buzzIndex !== -1) {
      status.buzzOrder = buzzIndex + 1;
    }
    
    // Check if this player is currently answering
    status.isAnswering = buzzedUser?.id === user.id;
    
    // Show answer if this player has answered and is the current buzzed user
    if (hasAnswered && buzzedUser?.id === user.id && answer) {
      status.answer = answer;
    }
    
    // Check for recent judgment results
    const recentJudgment = recentJudgments.find(judgment => judgment.userId === user.id);
    if (recentJudgment) {
      status.answer = recentJudgment.answer;
      status.isJudged = true;
      status.isCorrect = recentJudgment.isCorrect;
    }
    
    // Find score
    const playerScore = scores.find(score => score.userId === user.id);
    if (playerScore) {
      status.score = playerScore.score;
    }
    
    return status;
  };

  return (
    <Card variant="elevated" className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Players</h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {users.length}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {users.map((user) => (
            <PlayerItem
              key={user.id}
              user={user}
              isCurrentUser={user.id === currentUserId}
              status={getPlayerStatus(user)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 