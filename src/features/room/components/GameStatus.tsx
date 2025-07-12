/**
 * Game Status component for Quiz World application
 * - Shows waiting state when no quiz is active
 * - Displays different messages for host vs regular users
 * - Provides quiz management access for hosts
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Game status component props
 */
interface GameStatusProps {
  isHost: boolean;
  hasQuizzes: boolean;
  onManageQuizzes: () => void;
}

/**
 * Game status component - shows waiting state or embedded quiz
 */
export function GameStatus({ isHost, hasQuizzes, onManageQuizzes }: GameStatusProps) {
  return (
    <Card variant="gradient">
      <CardContent>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎮</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Waiting for Quiz
          </h3>
          <p className="text-gray-600 mb-4">
            {isHost 
              ? 'Create and start a quiz to begin the game!'
              : 'The host will start a quiz soon.'
            }
          </p>
          {isHost && hasQuizzes && (
            <Button onClick={onManageQuizzes}>
              Start Quiz
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 