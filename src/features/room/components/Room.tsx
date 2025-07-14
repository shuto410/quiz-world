/**
 * Main Room component for Quiz World application
 * - Orchestrates room functionality using smaller components
 * - Manages room state and socket communication
 * - Integrates quiz game functionality within room layout
 */

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { QuizCreator } from '@/features/quiz/components/QuizCreator';
import { RoomHeader } from './RoomHeader';
import { PlayerList } from './PlayerList';
import { Chat } from './Chat';
import { GameStatus } from './GameStatus';
import { IntegratedQuizGame } from './IntegratedQuizGame';
import { QuizManagement } from './QuizManagement';
import type { Room, User } from '@/types';
import { useRoomGame } from '../hooks/useRoomGame';

/**
 * Room component interface
 */
interface RoomProps {
  room: Room;
  currentUser: User;
  onLeave?: () => void;
  className?: string;
}

/**
 * Main Room component
 */
export function Room({ room, currentUser, onLeave, className }: RoomProps) {
  const {
    showQuizModal, setShowQuizModal,
    showQuizCreator, setShowQuizCreator,
    roomQuizzes,
    error, setError,
    gameState,
    currentQuizIndex,
    currentQuiz,
    quizGameState,
    scores,
    buzzedUser,
    buzzedUsers,
    answer, setAnswer,
    hasAnswered,
    showAnswer,
    recentJudgments,
    isHost, currentUserName, currentUserId,
    handleLeaveRoom,
    handleStartQuiz,
    handleEndQuiz,
    handleNextQuiz,
    handleOpenQuizCreator,
    handleQuizCreated,
    handleBuzzInUser,
    handleSubmitAnswer,
    handleShowAnswer,
    handleJudgeAnswer,
  } = useRoomGame(room, currentUser, onLeave);

  /**
   * Determine what to show in the game area
   */
  const renderGameArea = () => {
    if (gameState === 'quiz-active' && currentQuiz) {
      return (
        <IntegratedQuizGame
          quiz={currentQuiz}
          users={room.users}
          isHost={isHost}
          gameState={quizGameState}
          scores={scores}
          showAnswer={showAnswer}
          onEndQuiz={handleEndQuiz}
          onNextQuiz={handleNextQuiz}
          isLastQuiz={currentQuizIndex === roomQuizzes.length - 1}
        />
      );
    }
    if (gameState === 'quiz-finished') {
      // 全問終了時のスコア表示
      return (
        <IntegratedQuizGame
          quiz={roomQuizzes[roomQuizzes.length - 1]}
          users={room.users}
          isHost={isHost}
          gameState={'finished'}
          scores={scores}
          showAnswer={showAnswer}
          onEndQuiz={handleEndQuiz}
          onNextQuiz={handleNextQuiz}
          isLastQuiz={true}
        />
      );
    }
    return (
      <GameStatus
        isHost={isHost}
        hasQuizzes={roomQuizzes.length > 0}
        onManageQuizzes={() => setShowQuizModal(true)}
      />
    );
  };

  // Main room layout
  return (
    <div className={className} data-testid="room-component">
      {/* Room Header */}
      <RoomHeader 
        room={room}
        isHost={isHost}
        onManageQuizzes={() => setShowQuizModal(true)}
        onLeave={handleLeaveRoom}
      />

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 text-sm font-medium"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Sidebar - User List + Chat (expanded to 2/5 width) */}
        <div className="lg:col-span-2 space-y-4">
          <PlayerList
            users={room.users}
            currentUserId={currentUserId}
            scores={scores}
            buzzedUsers={buzzedUsers}
            buzzedUser={buzzedUser}
            answer={answer}
            hasAnswered={hasAnswered}
            recentJudgments={recentJudgments}
          />
          
          {/* Chat - in sidebar */}
          <Chat
            roomName={room.name}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        </div>

        {/* Game Area - takes up 3/5 of the width */}
        <div className="lg:col-span-3">
          {renderGameArea()}
        </div>
      </div>

      {/* Buzz and Answer Section - outside of quiz game */}
      {(gameState === 'quiz-active') && currentQuiz && (
        <div className="mt-1 lg:ml-[calc(40%+1.5rem)]">
          <Card variant="gradient">
            <CardContent>
              <div className="py-2">
                {/* Buzz Button - Only for non-host users */}
                {!buzzedUser && quizGameState === 'active' && !isHost && (
                  <div className="text-center mb-2">
                    <Button
                      size="md"
                      variant="success"
                      onClick={handleBuzzInUser}
                      className="animate-pulse text-lg px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 transform hover:scale-105 transition-all"
                    >
                      🔔 Buzz In
                    </Button>
                  </div>
                )}

                {/* Answer Input for Buzzed User (Non-host only) */}
                {buzzedUser && buzzedUser.id === currentUser.id && !hasAnswered && !isHost && (
                  <div className="mb-3">
                    <div className="text-center mb-2">
                      <span className="text-lg">⚡</span>
                      <span className="text-sm font-medium text-gray-800 ml-2">
                        Type your answer:
                      </span>
                    </div>
                    <div className="max-w-sm mx-auto">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => setAnswer(e.target.value)}
                          placeholder="Your answer..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              handleSubmitAnswer();
                            }
                          }}
                          autoFocus
                        />
                        <Button 
                          variant="primary" 
                          onClick={handleSubmitAnswer} 
                          disabled={!answer.trim()}
                          className="px-4 py-2 text-sm"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Waiting for Answer */}
                {buzzedUser && buzzedUser.id !== currentUser.id && (
                  <div className="text-center mb-3">
                    <span className="text-lg">⏳</span>
                    <span className="text-sm font-medium text-gray-800 ml-2">
                      <strong>{buzzedUser.name}</strong> is answering...
                    </span>
                  </div>
                )}

                {/* Answer Judging Section - Host only */}
                {isHost && (hasAnswered || quizGameState === 'answered') && !showAnswer && (
                  <div className="mb-3">
                    <div className="text-center mb-2">
                      <span className="text-lg">⚖️</span>
                      <span className="text-sm font-medium text-gray-800 ml-2">
                        Judge {buzzedUser ? buzzedUser.name : 'player'}&apos;s answer:
                      </span>
                    </div>
                    {/* Display the participant's answer */}
                    <div className="text-center mb-3">
                      <div className="inline-block bg-gray-100 border border-gray-300 rounded-lg px-4 py-2">
                        <span className="text-lg font-medium text-gray-800">
                          &quot;{answer || 'Loading answer...'}&quot;
                        </span>
                      </div>
                    </div>
                    <div className="max-w-sm mx-auto">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => handleJudgeAnswer(true)}
                          className="px-4 py-2 text-sm"
                        >
                          ✓ Correct
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleJudgeAnswer(false)}
                          className="px-4 py-2 text-sm"
                        >
                          ✗ Incorrect
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show Answer Button for Host */}
                {isHost && hasAnswered && !showAnswer && (
                  <div className="text-center mb-3">
                    <Button onClick={handleShowAnswer} variant="secondary" className="text-sm py-2">
                      Show Answer
                    </Button>
                  </div>
                )}

                {/* Answer Reveal */}
                {showAnswer && (
                  <div className="text-center mb-3">
                    <span className="text-lg">💡</span>
                    <span className="text-sm font-medium text-gray-800 ml-2">
                      Answer: <strong>{currentQuiz.answer}</strong>
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quiz Management Modal */}
      <Modal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        title="Quiz Management"
        size="lg"
      >
        <QuizManagement
          quizzes={roomQuizzes}
          onStartQuiz={handleStartQuiz}
          onCreateQuiz={handleOpenQuizCreator}
        />
      </Modal>



      {/* Quiz Creator */}
      <QuizCreator
        isOpen={showQuizCreator}
        onClose={() => setShowQuizCreator(false)}
        onQuizCreated={handleQuizCreated}
      />
    </div>
  );
}