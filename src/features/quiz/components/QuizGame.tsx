/**
 * Refactored Quiz Game component for Quiz World application
 * - Split into smaller, focused components
 * - Uses custom hooks for timer management
 * - Maintains anime pop style design
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { Quiz, User, Score } from '@/types';
import { submitAnswer, getSocket } from '@/lib/socketClient';
import { useQuizTimer } from '../hooks/useQuizTimer';

/**
 * Timer display component
 */
interface TimerDisplayProps {
  timeLeft: number;
  isActive: boolean;
}

function TimerDisplay({ timeLeft, isActive }: TimerDisplayProps) {
  if (!isActive) return null;

  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-pink-600">{timeLeft}s</div>
      <div className="text-sm text-gray-600">Time Left</div>
    </div>
  );
}

/**
 * Question display component
 */
interface QuestionDisplayProps {
  quiz: Quiz;
  gameState: 'waiting' | 'active' | 'answered' | 'finished';
  buzzedUser?: User | null;
}

function QuestionDisplay({ quiz, gameState, buzzedUser }: QuestionDisplayProps) {
  return (
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
                src={
                  quiz.image.type === 'url'
                    ? quiz.image.data
                    : `data:image/jpeg;base64,${quiz.image.data}`
                }
                alt="Quiz image"
                width={400}
                height={384}
                className="w-full max-w-md h-auto rounded-lg shadow-lg object-contain"
                style={{ maxHeight: '24rem' }}
              />
            </div>
          )}

          {/* Game State Display */}
          <GameStateDisplay 
            gameState={gameState} 
            buzzedUser={buzzedUser}
            quizType={quiz.type}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Game state display component
 */
interface GameStateDisplayProps {
  gameState: 'waiting' | 'active' | 'answered' | 'finished';
  buzzedUser?: User | null;
  quizType: 'text' | 'image';
}

function GameStateDisplay({ gameState, buzzedUser, quizType }: GameStateDisplayProps) {
  if (gameState === 'waiting') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">Waiting for host to start...</p>
      </div>
    );
  }

  if (gameState === 'active' && !buzzedUser && quizType === 'text') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">🔔</div>
        <p className="text-gray-600">Press the buzzer to answer!</p>
      </div>
    );
  }

  if (gameState === 'active' && buzzedUser) {
    return (
      <div className="text-center py-4">
        <div className="text-2xl mb-2">🎯</div>
        <p className="text-gray-600">
          <strong>{buzzedUser.name}</strong> is answering...
        </p>
      </div>
    );
  }

  if (gameState === 'answered') {
    return (
      <div className="text-center py-4">
        <div className="text-2xl mb-2">✅</div>
        <p className="text-gray-600">Answer submitted!</p>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="text-center py-4">
        <div className="text-2xl mb-2">🏁</div>
        <p className="text-gray-600">Quiz finished!</p>
      </div>
    );
  }

  return null;
}

/**
 * Buzzer component for text quiz
 */
interface BuzzerProps {
  canBuzz: boolean;
  isBuzzed: boolean;
  buzzedUser?: User | null;
  onBuzz: () => void;
  onShowAnswerModal: () => void;
}

function Buzzer({ canBuzz, isBuzzed, buzzedUser, onBuzz, onShowAnswerModal }: BuzzerProps) {
  return (
    <Card variant="elevated">
      <CardContent>
        <div className="text-center py-8">
          {canBuzz ? (
            <Button
              size="lg"
              variant="primary"
              onClick={onBuzz}
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
                onClick={onShowAnswerModal}
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
  );
}

/**
 * Answer input for image quiz
 */
interface ImageAnswerInputProps {
  answer: string;
  isHost: boolean;
  onAnswerChange: (answer: string) => void;
  onJudge: (isCorrect: boolean) => void;
}

function ImageAnswerInput({ answer, isHost, onAnswerChange, onJudge }: ImageAnswerInputProps) {
  return (
    <Card variant="elevated">
      <CardHeader>
        <h3 className="text-lg font-semibold text-gray-800">Your Answer</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <input
            type="text"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            placeholder="Type your answer..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            disabled={!isHost}
          />
          {isHost && (
            <div className="flex gap-3">
              <Button
                variant="success"
                onClick={() => onJudge(true)}
                disabled={!answer.trim()}
              >
                Correct
              </Button>
              <Button
                variant="danger"
                onClick={() => onJudge(false)}
                disabled={!answer.trim()}
              >
                Incorrect
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Scoreboard component
 */
interface ScoreboardProps {
  scores: Score[];
  users: User[];
  currentUserId: string;
}

function Scoreboard({ scores, users, currentUserId }: ScoreboardProps) {
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  return (
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
                  score.userId === currentUserId
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
                <span className="font-bold text-pink-600">{score.score}</span>
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
  );
}

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
 * Refactored Quiz Game component
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

  // Use quiz timer hook
  const { timeLeft } = useQuizTimer(30, {
    autoStart: gameState === 'active',
    onExpire: () => {
      if (gameState === 'active') {
        setResult('incorrect');
        setShowResultModal(true);
      }
    },
  });

  // Show result modal when game state is finished
  useEffect(() => {
    if (gameState === 'finished' && isHost) {
      setShowResultModal(true);
      setResult('correct'); // Default to correct for testing
    }
  }, [gameState, isHost]);

  // Reset state when quiz changes
  useEffect(() => {
    setAnswer('');
    setResult(null);
  }, [quiz.id]);

  const canBuzz = gameState === 'active' && !buzzedUser && !isHost;
  const canAnswer = gameState === 'active' && buzzedUser?.id === currentUser.id;
  const isBuzzed = buzzedUser?.id === currentUser.id;

  /**
   * Handle buzzer press for text quiz
   */
  const handleBuzzIn = () => {
    if (canBuzz) {
      const socket = getSocket();
      if (socket) {
        socket.emit('game:buzz', { user: currentUser });
      }
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
          <TimerDisplay timeLeft={timeLeft} isActive={gameState === 'active'} />
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
          <QuestionDisplay 
            quiz={quiz}
            gameState={gameState}
            buzzedUser={buzzedUser}
          />

          {/* Answer Input for Image Quiz */}
          {quiz.type === 'image' && gameState === 'active' && (
            <ImageAnswerInput
              answer={answer}
              isHost={isHost}
              onAnswerChange={setAnswer}
              onJudge={handleJudgeAnswer}
            />
          )}

          {/* Buzzer for Text Quiz */}
          {quiz.type === 'text' && gameState === 'active' && (
            <Buzzer
              canBuzz={canBuzz}
              isBuzzed={isBuzzed}
              buzzedUser={buzzedUser}
              onBuzz={handleBuzzIn}
              onShowAnswerModal={() => setShowAnswerModal(true)}
            />
          )}
        </div>

        {/* Scoreboard */}
        <div className="lg:col-span-1">
          <Scoreboard 
            scores={scores}
            users={users}
            currentUserId={currentUser.id}
          />
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