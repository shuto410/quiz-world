/**
 * Main Room component for Quiz World application
 * - Orchestrates room functionality using smaller components
 * - Manages room state and socket communication
 * - Integrates quiz game functionality within room layout
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { QuizCreator } from '@/features/quiz/components/QuizCreator';
import { RoomHeader } from './RoomHeader';
import { PlayerList } from './PlayerList';
import { Chat } from './Chat';
import { GameStatus } from './GameStatus';
import { IntegratedQuizGame } from './IntegratedQuizGame';
import { QuizManagement } from './QuizManagement';
import type { Room, User, Quiz, Score } from '@/types';
import { leaveRoom, transferHost, startQuiz, addQuiz, getSocket } from '@/lib/socketClient';
import { getUserName, getUserId } from '@/lib/userStorage';

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
 * Game state type
 */
type GameState = 'lobby' | 'quiz-active' | 'quiz-answered' | 'quiz-finished';

/**
 * Main Room component
 */
export function Room({ room, currentUser, onLeave, className }: RoomProps) {
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [showQuizCreator, setShowQuizCreator] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roomQuizzes, setRoomQuizzes] = useState(room.quizzes);
  const [error, setError] = useState<string | null>(null);
  
  // Game state management
  const [gameState, setGameState] = useState<GameState>('lobby');
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [quizGameState, setQuizGameState] = useState<'waiting' | 'active' | 'answered' | 'finished'>('waiting');
  const [scores, setScores] = useState<Score[]>([]);
  const [buzzedUser, setBuzzedUser] = useState<User | null>(null);
  const [buzzedUsers, setBuzzedUsers] = useState<User[]>([]);

  const isHost = currentUser.isHost;
  const currentUserName = getUserName() || currentUser.name;
  const currentUserId = getUserId();

  /**
   * Synchronize roomQuizzes with room.quizzes when room changes
   */
  useEffect(() => {
    setRoomQuizzes(room.quizzes);
  }, [room.quizzes]);

  /**
   * Set up socket event listeners for quiz synchronization and game events
   */
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for quiz added event from server
    const handleQuizAdded = (data: { quiz: Quiz }) => {
      console.log('Quiz added via socket:', data.quiz);
      setRoomQuizzes(prev => {
        // Check if quiz already exists to prevent duplicates
        const existingQuizIndex = prev.findIndex(quiz => quiz.id === data.quiz.id);
        if (existingQuizIndex !== -1) {
          console.log('Quiz already exists, not adding duplicate:', data.quiz.id);
          return prev;
        }
        return [...prev, data.quiz];
      });
    };

    // Listen for quiz removed event from server
    const handleQuizRemoved = (data: { quizId: string }) => {
      console.log('Quiz removed via socket:', data.quizId);
      setRoomQuizzes(prev => prev.filter(quiz => quiz.id !== data.quizId));
    };

    // Listen for quiz game events
    const handleQuizStarted = (data: { quiz: Quiz }) => {
      console.log('Quiz started via socket:', data.quiz);
      setCurrentQuiz(data.quiz);
      setGameState('quiz-active');
      setQuizGameState('active');
      setBuzzedUser(null);
      setBuzzedUsers([]);
    };

    const handleQuizEnded = () => {
      console.log('Quiz ended via socket');
      setGameState('quiz-finished');
      setQuizGameState('finished');
      setBuzzedUser(null);
      setBuzzedUsers([]);
    };

    const handleBuzzIn = (data: { user: User }) => {
      console.log('User buzzed in:', data.user);
      // Verify the user is still in the room
      const userStillInRoom = room.users.some(u => u.id === data.user.id);
      if (!userStillInRoom) {
        console.warn('Buzzed user is no longer in the room');
        return;
      }
      
      // Add to buzzed users list if not already there
      setBuzzedUsers(prev => {
        const alreadyBuzzed = prev.some((u: User) => u.id === data.user.id);
        if (!alreadyBuzzed) {
          return [...prev, data.user];
        }
        return prev;
      });
      
      // Set as current buzzed user if no one is currently answering
      if (!buzzedUser) {
        setBuzzedUser(data.user);
      }
    };

    const handleAnswerSubmitted = (data: { user: User, answer: string }) => {
      console.log('Answer submitted:', data.user, data.answer);
      setQuizGameState('answered');
    };

    const handleScoreUpdate = (data: { scores: Score[] }) => {
      console.log('Score updated:', data.scores);
      setScores(data.scores);
    };

    socket.on('quiz:added', handleQuizAdded);
    socket.on('quiz:removed', handleQuizRemoved);
    socket.on('quiz:started', handleQuizStarted);
    socket.on('quiz:ended', handleQuizEnded);
    socket.on('game:buzz', handleBuzzIn);
    socket.on('game:answer', handleAnswerSubmitted);
    socket.on('game:score', handleScoreUpdate);

    // Cleanup listeners on unmount
    return () => {
      socket.off('quiz:added', handleQuizAdded);
      socket.off('quiz:removed', handleQuizRemoved);
      socket.off('quiz:started', handleQuizStarted);
      socket.off('quiz:ended', handleQuizEnded);
      socket.off('game:buzz', handleBuzzIn);
      socket.off('game:answer', handleAnswerSubmitted);
      socket.off('game:score', handleScoreUpdate);
    };
  }, [room.users]);

  /**
   * Handle leaving the room
   */
  const handleLeaveRoom = () => {
    leaveRoom();
    onLeave?.();
  };

  /**
   * Transfer host to another user
   */
  const handleTransferHost = () => {
    if (!selectedUser) return;
    
    transferHost(selectedUser.id);
    setShowHostModal(false);
    setSelectedUser(null);
  };

  /**
   * Start a quiz
   */
  const handleStartQuiz = (quiz: Quiz) => {
    try {
      startQuiz(quiz.id);
      setShowQuizModal(false);
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Failed to start quiz:', error);
      setError('Failed to start quiz. Please try again.');
      
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  /**
   * End the current quiz
   */
  const handleEndQuiz = () => {
    setGameState('lobby');
    setQuizGameState('waiting');
    setCurrentQuiz(null);
    setBuzzedUser(null);
    setBuzzedUsers([]);
    // Emit quiz end event to server
    const socket = getSocket();
    if (socket) {
      socket.emit('quiz:ended');
    }
  };

  /**
   * Handle next quiz (for now, just return to lobby)
   */
  const handleNextQuiz = () => {
    setGameState('lobby');
    setQuizGameState('waiting');
    setCurrentQuiz(null);
    setBuzzedUser(null);
    setBuzzedUsers([]);
  };

  /**
   * Handle making user host
   */
  const handleMakeHost = (user: User) => {
    setSelectedUser(user);
    setShowHostModal(true);
  };

  /**
   * Open quiz creator
   */
  const handleOpenQuizCreator = () => {
    setShowQuizModal(false);
    setShowQuizCreator(true);
  };

  /**
   * Handle quiz created
   */
  const handleQuizCreated = async (quiz: Quiz) => {
    try {
      console.log('Quiz created:', quiz);
      await addQuiz(quiz); // Send to server, which will broadcast to all clients
      setShowQuizCreator(false);
    } catch (error) {
      console.error('Failed to add quiz:', error);
      setError('Failed to add quiz. Please try again.');
      
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  // Determine what to show in the game area
  const renderGameArea = () => {
    if ((gameState === 'quiz-active' || gameState === 'quiz-finished') && currentQuiz) {
      return (
                    <IntegratedQuizGame
              quiz={currentQuiz}
              currentUser={currentUser}
              users={room.users}
              isHost={isHost}
              gameState={quizGameState}
              scores={scores}
              buzzedUser={buzzedUser}
              buzzedUsers={buzzedUsers}
              onEndQuiz={handleEndQuiz}
              onNextQuiz={handleNextQuiz}
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - User List + Chat */}
        <div className="lg:col-span-1 space-y-4">
          <PlayerList
            users={room.users}
            currentUserId={currentUserId}
            isHost={isHost}
            onMakeHost={handleMakeHost}
          />
          
          {/* Chat - in sidebar */}
          <Chat
            roomName={room.name}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        </div>

        {/* Game Area - takes up 3/4 of the width */}
        <div className="lg:col-span-3">
          {renderGameArea()}
        </div>
      </div>

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

      {/* Host Transfer Modal */}
      <Modal
        isOpen={showHostModal}
        onClose={() => setShowHostModal(false)}
        title="Transfer Host"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Transfer host role to <strong>{selectedUser?.name}</strong>?
          </p>
          <div className="flex gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowHostModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleTransferHost}>
              Transfer Host
            </Button>
          </div>
        </div>
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