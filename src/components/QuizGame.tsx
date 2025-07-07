/**
 * Quiz Game component for Quiz World application
 * - Handles both text (buzzer) and image quiz types
 * - Provides buzzer functionality for text quizzes
 * - Shows image and text input for image quizzes
 * - Displays real-time game state and scores
 * - Follows anime pop style design
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import type { Quiz, User, Score } from '../types';
import { submitAnswer } from '../lib/socketClient';


/**
 * Quiz Game props interface
 */
export interface QuizGameProps {
  quiz: Quiz;
  currentUser: User;
  users: User[];
  isHost: boolean;
  gameState: 'waiting' | 'active' | 'answered' | 'finished';
  scores: Score[];
  buzzedUser?: User | null;
  onEndQuiz?: () => void;
  onNextQuiz?: () => void;
  className?: string;
}

/**
 * Quiz Game component with anime pop style
 */
export function QuizGame({
  quiz,
  currentUser,
  users,
  isHost,
  gameState,
  scores,
  buzzedUser,
  onEndQuiz,
  onNextQuiz,
  className,
}: QuizGameProps) {
  const [answer, setAnswer] = useState('');
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);

  // Show result modal when game state is finished
  useEffect(() => {
    if (gameState === 'finished' && isHost) {
      setShowResultModal(true);
      setResult('correct'); // Default to correct for testing
    }
  }, [gameState, isHost]);
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds per question

  // const currentUserName = getUserName() || currentUser.name;
  const canBuzz = gameState === 'active' && !buzzedUser && !isHost;
  const canAnswer = gameState === 'active' && buzzedUser?.id === currentUser.id;
  const isBuzzed = buzzedUser?.id === currentUser.id;

  // Timer countdown
  useEffect(() => {
    if (gameState === 'active' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && gameState === 'active') {
      // Time's up
      setResult('incorrect');
      setShowResultModal(true);
    }
  }, [timeLeft, gameState]);

  // Reset timer when quiz changes
  useEffect(() => {
    setTimeLeft(30);
    setAnswer('');
    setResult(null);
  }, [quiz.id]);

  /**
   * Handle buzzer press for text quiz
   */
  const handleBuzzIn = () => {
    if (canBuzz) {
      // TODO: Implement buzzer functionality
      console.log('Buzzer pressed');
    }
  };

  /**
   * Handle answer submission
   */
  const handleSubmitAnswer = () => {
    if (!answer.trim() || !canAnswer) return;

    submitAnswer(quiz.id, answer.trim());
    setShowAnswerModal(false);
  };

  /**
   * Handle host judgment
   */
  const handleJudgeAnswer = (isCorrect: boolean) => {
    setResult(isCorrect ? 'correct' : 'incorrect');
    setShowResultModal(true);
  };

  /**
   * Get sorted scores
   */
  const sortedScores = [...scores].sort((a, b) => b.value - a.value);

  return (
    <div className={className}>
      {/* Game Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quiz Game</h1>
          <p className="text-gray-600">
            {quiz.type === 'text' ? 'Text Quiz' : 'Image Quiz'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {gameState === 'active' && (
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-600">{timeLeft}s</div>
              <div className="text-sm text-gray-600">Time Left</div>
            </div>
          )}
          {isHost && (
            <Button variant="danger" onClick={onEndQuiz}>
              End Quiz
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quiz Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Question Card */}
          <Card variant="gradient">
            <CardHeader>
              <h2 className="text-xl font-semibold text-gray-800">Question</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Question Text */}
                <div className="text-lg text-gray-700">{quiz.question}</div>

                {/* Image for image quiz */}
                {quiz.type === 'image' && quiz.image && (
                  <div className="flex justify-center">
                    <Image
                      src={quiz.image.type === 'url' ? quiz.image.data : quiz.image.data}
                      alt="Quiz image"
                      width={400}
                      height={384}
                      className="max-w-full max-h-96 rounded-lg shadow-lg object-cover"
                    />
                  </div>
                )}

                {/* Game State Display */}
                {gameState === 'waiting' && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">⏳</div>
                    <p className="text-gray-600">Waiting for host to start...</p>
                  </div>
                )}

                {gameState === 'active' && !buzzedUser && quiz.type === 'text' && (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🔔</div>
                    <p className="text-gray-600">Press the buzzer to answer!</p>
                  </div>
                )}

                {gameState === 'active' && buzzedUser && (
                  <div className="text-center py-4">
                    <div className="text-2xl mb-2">🎯</div>
                    <p className="text-gray-600">
                      <strong>{buzzedUser.name}</strong> is answering...
                    </p>
                  </div>
                )}

                {gameState === 'answered' && (
                  <div className="text-center py-4">
                    <div className="text-2xl mb-2">✅</div>
                    <p className="text-gray-600">Answer submitted!</p>
                  </div>
                )}

                {gameState === 'finished' && (
                  <div className="text-center py-4">
                    <div className="text-2xl mb-2">🏁</div>
                    <p className="text-gray-600">Quiz finished!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Answer Input for Image Quiz */}
          {quiz.type === 'image' && gameState === 'active' && (
            <Card variant="elevated">
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-800">Your Answer</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    disabled={!isHost}
                  />
                  {isHost && (
                    <div className="flex gap-3">
                      <Button
                        variant="success"
                        onClick={() => handleJudgeAnswer(true)}
                        disabled={!answer.trim()}
                      >
                        Correct
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => handleJudgeAnswer(false)}
                        disabled={!answer.trim()}
                      >
                        Incorrect
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Buzzer for Text Quiz */}
          {quiz.type === 'text' && gameState === 'active' && (
            <Card variant="elevated">
              <CardContent>
                <div className="text-center py-8">
                  {canBuzz ? (
                    <Button
                      size="lg"
                      variant="primary"
                      onClick={handleBuzzIn}
                      className="text-2xl px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transform hover:scale-105 transition-all"
                    >
                      🔔 BUZZ IN!
                    </Button>
                  ) : isBuzzed ? (
                    <div className="space-y-4">
                      <div className="text-4xl">🎯</div>
                      <p className="text-lg font-semibold text-gray-800">
                        You got it! Answer now!
                      </p>
                      <Button
                        variant="primary"
                        onClick={() => setShowAnswerModal(true)}
                      >
                        Give Answer
                      </Button>
                    </div>
                  ) : buzzedUser ? (
                    <div className="space-y-4">
                      <div className="text-4xl">⏳</div>
                      <p className="text-lg text-gray-600">
                        {buzzedUser.name} is answering...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-4xl">🔔</div>
                      <p className="text-lg text-gray-600">
                        Press the buzzer to answer!
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Scoreboard */}
        <div className="lg:col-span-1">
          <Card variant="elevated">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-800">Scoreboard</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedScores.map((score, index) => {
                  const user = users.find((u: User) => u.id === score.userId);
                  return (
                    <div
                      key={score.userId}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        score.userId === currentUser.id
                          ? 'bg-pink-100 border border-pink-200'
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤'}
                        </span>
                        <span className="font-medium text-gray-800">
                          {user?.name || 'Unknown'}
                        </span>
                      </div>
                      <span className="font-bold text-pink-600">{score.value}</span>
                    </div>
                  );
                })}
                {sortedScores.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No scores yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Answer Modal for Text Quiz */}
      <Modal
        isOpen={showAnswerModal}
        onClose={() => setShowAnswerModal(false)}
        title="Your Answer"
        size="md"
      >
        <div className="space-y-4">
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowAnswerModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitAnswer}
              disabled={!answer.trim()}
            >
              Submit Answer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Result Modal */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={result === 'correct' ? 'Correct!' : 'Incorrect!'}
        size="sm"
      >
        <div className="space-y-4 text-center">
          <div className="text-6xl">
            {result === 'correct' ? '🎉' : '😔'}
          </div>
          <p className="text-lg text-gray-700">
            {result === 'correct' 
              ? 'Great job! That\'s correct!'
              : 'Better luck next time!'
            }
          </p>
          <p className="text-sm text-gray-600">
            Answer: <strong>{quiz.answer}</strong>
          </p>
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowResultModal(false)}>
              Close
            </Button>
            {onNextQuiz && (
              <Button variant="primary" onClick={onNextQuiz}>
                Next Quiz
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
} 