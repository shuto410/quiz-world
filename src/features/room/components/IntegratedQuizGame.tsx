/**
 * Integrated Quiz Game component for Quiz World application
 * - Embedded quiz game within room layout
 * - Handles buzz-in, answer submission, and scoring
 * - Provides host controls and game state management
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSocket } from '@/lib/socketClient';
import type { Quiz, User, Score } from '@/types';

/**
 * Integrated Quiz Game component props
 */
interface IntegratedQuizGameProps {
  quiz: Quiz;
  currentUser: User;
  users: User[];
  isHost: boolean;
  gameState: 'waiting' | 'active' | 'answered' | 'finished';
  scores: Score[];
  buzzedUsers: User[];
  onEndQuiz: () => void;
  onNextQuiz: () => void;
}

/**
 * Integrated Quiz Game component - embedded within room layout
 */
export function IntegratedQuizGame({
  quiz,
  currentUser,
  users,
  isHost,
  gameState,
  scores,
  buzzedUsers,
  onEndQuiz,
  onNextQuiz,
}: IntegratedQuizGameProps) {
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleBuzzIn = () => {
    const socket = getSocket();
    if (socket && !buzzedUsers.some(u => u.id === currentUser.id)) {
      socket.emit('game:buzz', { user: currentUser });
    }
  };

  const handleSubmitAnswer = () => {
    if (answer.trim()) {
      const socket = getSocket();
      if (socket) {
        socket.emit('game:answer', { user: currentUser, answer: answer.trim() });
        setHasAnswered(true);
      }
    }
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
  };

  const handleBackToLobby = () => {
    onEndQuiz();
  };

  if (gameState === 'finished') {
    return (
      <Card variant="gradient">
        <CardContent>
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Quiz Finished!
            </h3>
            
            {scores.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-medium text-gray-800 mb-3">Final Scores</h4>
                <div className="space-y-2">
                  {scores
                    .sort((a, b) => b.score - a.score)
                    .map((score, index) => (
                      <div
                        key={score.userId}
                        className={`flex justify-between items-center p-3 rounded-lg ${
                          index === 0
                            ? 'bg-yellow-100 border-2 border-yellow-300'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center">
                          {index === 0 && <span className="text-yellow-500 mr-2">🏆</span>}
                          <span className="font-medium">
                            {users.find(u => u.id === score.userId)?.name || 'Unknown'}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-gray-800">
                          {score.score}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              <Button onClick={handleBackToLobby}>
                Back to Lobby
              </Button>
              {isHost && (
                <Button variant="success" onClick={onNextQuiz}>
                  Next Quiz
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="gradient">
      <CardContent>
        <div className="py-6">
          {/* Question */}
          <div className="text-center mb-6">
            <div className="text-4xl mb-4">❓</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {quiz.question}
            </h3>
            <p className="text-gray-600">
              Type: {quiz.type}
            </p>
          </div>

          {/* Buzz In Section */}
          {buzzedUsers.length === 0 && gameState === 'active' && (
            <div className="text-center mb-6">
              <Button
                size="lg"
                variant="success"
                onClick={handleBuzzIn}
                className="animate-pulse"
              >
                🔔 Buzz In
              </Button>
            </div>
          )}

          {/* Buzzed Users Display */}
          {buzzedUsers.length > 0 && (
            <div className="text-center mb-6">
              <div className="text-2xl mb-2">⚡</div>
              <div className="flex flex-col items-center gap-2">
                {buzzedUsers.map((user, idx) => (
                  <div key={user.id} className="flex items-center gap-2">
                    <span className="font-medium">{idx + 1}.</span>
                    <span className="font-medium text-gray-800">{user.name}</span>
                    <span className="text-sm text-gray-500">buzzed in!</span>
                  </div>
                ))}
              </div>

              {/* Answer Input for First Buzzed User Only */}
              {buzzedUsers[0].id === currentUser.id && !hasAnswered && (
                <div className="mt-4 max-w-md mx-auto">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          handleSubmitAnswer();
                        }
                      }}
                      autoFocus
                    />
                    <Button onClick={handleSubmitAnswer} disabled={!answer.trim()}>
                      Submit
                    </Button>
                  </div>
                </div>
              )}

              {/* Show Answer Button for Host */}
              {isHost && hasAnswered && !showAnswer && (
                <div className="mt-4">
                  <Button onClick={handleShowAnswer}>
                    Show Answer
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Answer Reveal */}
          {showAnswer && (
            <div className="text-center mb-6">
              <div className="text-2xl mb-2">💡</div>
              <p className="text-lg font-medium text-gray-800">
                Correct Answer: <strong>{quiz.answer}</strong>
              </p>
            </div>
          )}

          {/* Game Controls for Host */}
          {isHost && (
            <div className="text-center">
              <div className="flex gap-3 justify-center">
                <Button variant="ghost" onClick={handleBackToLobby}>
                  End Quiz
                </Button>
                {showAnswer && (
                  <Button variant="success" onClick={onNextQuiz}>
                    Next Quiz
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 