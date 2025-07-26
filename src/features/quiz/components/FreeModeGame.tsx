/**
 * Free Mode Game Component - Voice chat buzzer mode
 * 
 * SPECIFICATION:
 * - Large buzzer button for participants
 * - Host judgment buttons for correct/incorrect
 * - Real-time scoreboard display
 * - No question text or answer input required
 * 
 * KEY BEHAVIORS:
 * - Buzzer locks after first participant buzzes in
 * - Host judges with simple correct/incorrect buttons
 * - Automatic score increment (+1 for correct)
 * - Reset for next round after judgment
 * 
 * DEPENDENCIES:
 * - @/components/ui/Button, Card
 * - @/types for User type
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { User } from '@/types';


/**
 * Free Mode Game props
 */
interface FreeModeGameProps {
  users: User[];
  isHost: boolean;
  buzzedUser: User | null;
  onBuzzIn: () => void;
  onJudgeCorrect: () => void;
  onJudgeIncorrect: () => void;
  onNextRound: () => void;
  hasAnswered: boolean;
  showAnswer: boolean;
}


/**
 * Free Mode Game Component
 */
export function FreeModeGame({
  users,
  isHost,
  buzzedUser,
  onBuzzIn,
  onJudgeCorrect,
  onJudgeIncorrect,
  onNextRound,
  hasAnswered,
  showAnswer,
}: FreeModeGameProps) {
  const canBuzzIn = !buzzedUser && !isHost;
  const needsJudgment = isHost && buzzedUser && !hasAnswered && !showAnswer;

  return (
    <div className="space-y-6">
      {/* Main Game Area - Full Width */}
      <Card variant="gradient">
        <CardContent>
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              🎙️ Free Mode
            </h2>
            
            {/* Status Display */}
            <div className="mb-6">
              {!buzzedUser && (
                <p className="text-gray-600">
                  {isHost 
                    ? 'Read the question via voice chat...' 
                    : 'Listen for the question and buzz in!'}
                </p>
              )}
              
              {buzzedUser && !hasAnswered && (
                <div className="text-center">
                  <p className="text-lg text-yellow-700 mb-2">
                    ⚡ <strong>{buzzedUser.name}</strong> buzzed in!
                  </p>
                  {isHost ? (
                    <p className="text-sm text-gray-600">
                      Listen to their answer and judge below
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      {buzzedUser.id !== users.find(u => !u.isHost)?.id 
                        ? `Waiting for ${buzzedUser.name} to answer...`
                        : 'Give your answer via voice chat!'}
                    </p>
                  )}
                </div>
              )}
              
              {hasAnswered && !showAnswer && isHost && (
                <p className="text-gray-600">
                  Answer given! Judge the response below.
                </p>
              )}
            </div>
            
            {/* Buzzer Button */}
            {canBuzzIn && (
              <Button
                size="xl"
                variant="success"
                onClick={onBuzzIn}
                className="w-48 h-48 rounded-full text-3xl font-bold animate-pulse bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 transform hover:scale-105 transition-all shadow-lg"
              >
                🔔<br />BUZZ IN
              </Button>
            )}
            
            {/* Host Judgment Buttons */}
            {needsJudgment && (
              <div className="space-y-4">
                <p className="text-lg font-medium text-gray-800 mb-4">
                  Judge {buzzedUser.name}&apos;s answer:
                </p>
                <div className="flex gap-4 justify-center">
                  <Button
                    size="lg"
                    variant="success"
                    onClick={() => {
                      onJudgeCorrect();
                      onNextRound();
                    }}
                    className="px-8 py-4 text-lg"
                  >
                    ✓ Correct (+1)
                  </Button>
                  <Button
                    size="lg"
                    variant="danger"
                    onClick={() => {
                      onJudgeIncorrect();
                      onNextRound();
                    }}
                    className="px-8 py-4 text-lg"
                  >
                    ✗ Incorrect
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Instructions */}
      <Card variant="elevated">
        <CardContent>
          <div className="text-center py-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              📝 How Free Mode Works
            </h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>1. Host reads questions via voice chat (Discord, Skype, etc.)</p>
              <p>2. Participants buzz in using the button above</p>
              <p>3. First to buzz answers via voice chat</p>
              <p>4. Host judges correct (+1 point) or incorrect (0 points)</p>
              <p>5. Continue to next question</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}