/**
 * Integrated Quiz Game component for Quiz World application
 * - Embedded quiz game within room layout
 * - Handles buzz-in, answer submission, and scoring
 * - Provides host controls and game state management
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Quiz, User, Score } from '@/types';

/**
 * Integrated Quiz Game component props
 */
interface IntegratedQuizGameProps {
  quiz: Quiz;
  users: User[];
  isHost: boolean;
  gameState: 'waiting' | 'active' | 'answered' | 'finished';
  scores: Score[];
  showAnswer: boolean;
  onEndQuiz: () => void;
  onNextQuiz: () => void;
  isLastQuiz: boolean; // 追加
}

/**
 * Integrated Quiz Game component - embedded within room layout
 */
export function IntegratedQuizGame({
  quiz,
  users,
  isHost,
  gameState,
  scores,
  showAnswer,
  onEndQuiz,
  onNextQuiz,
  isLastQuiz,
}: IntegratedQuizGameProps) {

  const handleBackToLobby = () => {
    onEndQuiz();
  };

  if (gameState === 'finished' && isLastQuiz) {
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
              <Button onClick={onEndQuiz}>
                Back to Lobby
              </Button>
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

          {/* Buzzed Users Display - Now integrated into PlayerList */}

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