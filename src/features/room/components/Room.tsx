/**
 * Refactored Room component for Quiz World application
 * - Split into smaller, focused components
 * - Uses custom hooks for chat management
 * - Maintains anime pop style design
 * - Integrates QuizGame component for in-room gaming
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { QuizCreator } from '@/features/quiz/components/QuizCreator';
import type { Room, User, Quiz, Score } from '@/types';
import { leaveRoom, transferHost, startQuiz, addQuiz, getSocket } from '@/lib/socketClient';
import { getUserName, getUserId } from '@/lib/userStorage';
import { useChat } from '@/features/chat/hooks/useChat';

/**
 * Room header component
 */
interface RoomHeaderProps {
  room: Room;
  isHost: boolean;
  onManageQuizzes: () => void;
  onLeave: () => void;
}

function RoomHeader({ room, isHost, onManageQuizzes, onLeave }: RoomHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="room-name">{room.name}</h1>
        <p className="text-gray-600">
          {room.users.length}/{room.maxPlayers} players
          {room.isPublic && ' • Public Room'}
        </p>
      </div>
      <div className="flex gap-2">
        {isHost && (
          <Button variant="secondary" onClick={onManageQuizzes}>
            Manage Quizzes
          </Button>
        )}
        <Button variant="danger" onClick={onLeave}>
          Leave Room
        </Button>
      </div>
    </div>
  );
}

/**
 * Player list component
 */
interface PlayerListProps {
  users: User[];
  currentUserId: string;
  isHost: boolean;
  onMakeHost: (user: User) => void;
}

function PlayerList({ users, currentUserId, isHost, onMakeHost }: PlayerListProps) {
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

/**
 * Individual player item
 */
interface PlayerItemProps {
  user: User;
  isCurrentUser: boolean;
  canMakeHost: boolean;
  onMakeHost: () => void;
}

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
 * Chat component using useChat hook
 */
interface ChatProps {
  roomName: string;
  currentUserId: string;
  currentUserName: string;
}

function Chat({ roomName, currentUserId, currentUserName }: ChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const { messages, sendMessage } = useChat({ roomName, maxMessages: 100 });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessage(newMessage, currentUserId, currentUserName);
    setNewMessage('');
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-800">Chat</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Messages */}
          <div className="h-64 overflow-y-auto space-y-2">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>

          {/* Message Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Individual chat message
 */
interface ChatMessageProps {
  message: {
    id: string;
    userName: string;
    message: string;
    type: 'user' | 'system';
  };
}

function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div
      className={`flex gap-2 ${
        message.type === 'system' ? 'justify-center' : ''
      }`}
    >
      {message.type === 'user' && (
        <span className="font-medium text-pink-600">
          {message.userName}:
        </span>
      )}
      <span
        className={`${
          message.type === 'system'
            ? 'text-gray-500 italic text-sm'
            : 'text-gray-700'
        }`}
      >
        {message.message}
      </span>
    </div>
  );
}

/**
 * Game status component - shows waiting state or embedded quiz
 */
interface GameStatusProps {
  isHost: boolean;
  hasQuizzes: boolean;
  onManageQuizzes: () => void;
}

function GameStatus({ isHost, hasQuizzes, onManageQuizzes }: GameStatusProps) {
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

/**
 * Integrated Quiz Game component - embedded within room layout
 */
interface IntegratedQuizGameProps {
  quiz: Quiz;
  currentUser: User;
  users: User[];
  isHost: boolean;
  gameState: 'waiting' | 'active' | 'answered' | 'finished';
  scores: Score[];
  buzzedUser: User | null;
  onEndQuiz: () => void;
  onNextQuiz: () => void;
}

function IntegratedQuizGame({
  quiz,
  currentUser,
  users,
  isHost,
  gameState,
  scores,
  buzzedUser,
  onEndQuiz,
  onNextQuiz,
}: IntegratedQuizGameProps) {
  const [answer, setAnswer] = useState('');
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleBuzzIn = () => {
    const socket = getSocket();
    if (socket && !buzzedUser) {
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
          {!buzzedUser && gameState === 'active' && (
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

          {/* Buzzed User Display */}
          {buzzedUser && (
            <div className="text-center mb-6">
              <div className="text-2xl mb-2">⚡</div>
              <p className="text-lg font-medium text-gray-800">
                <strong>{buzzedUser.name}</strong> buzzed in!
              </p>
              
              {/* Answer Input for Buzzed User */}
              {buzzedUser.id === currentUser.id && !hasAnswered && (
                <div className="mt-4 max-w-md mx-auto">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
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

/**
 * Quiz management modal content
 */
interface QuizManagementProps {
  quizzes: Quiz[];
  onStartQuiz: (quiz: Quiz) => void;
  onCreateQuiz: () => void;
}

function QuizManagement({ quizzes, onStartQuiz, onCreateQuiz }: QuizManagementProps) {
  if (quizzes.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">📝</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          No quizzes available
        </h3>
        <p className="text-gray-600 mb-4">
          Create some quizzes to start the game!
        </p>
        <Button onClick={onCreateQuiz}>
          Create Quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quizzes.map((quiz) => (
        <QuizItem key={quiz.id} quiz={quiz} onStart={() => onStartQuiz(quiz)} />
      ))}
      <Button onClick={onCreateQuiz}>
        Create Quiz
      </Button>
    </div>
  );
}

/**
 * Individual quiz item
 */
interface QuizItemProps {
  quiz: Quiz;
  onStart: () => void;
}

function QuizItem({ quiz, onStart }: QuizItemProps) {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div>
        <h4 className="font-medium text-gray-800">{quiz.question}</h4>
        <p className="text-sm text-gray-600">
          Type: {quiz.type} • Answer: {quiz.answer}
        </p>
      </div>
      <Button
        variant="success"
        size="sm"
        onClick={onStart}
      >
        Start
      </Button>
    </div>
  );
}

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
 * Refactored Room component
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
    };

    const handleQuizEnded = () => {
      console.log('Quiz ended via socket');
      setGameState('quiz-active');
      setQuizGameState('finished');
      setBuzzedUser(null);
    };

    const handleBuzzIn = (data: { user: User }) => {
      console.log('User buzzed in:', data.user);
      setBuzzedUser(data.user);
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
  }, []);

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
    // Emit quiz end event to server
    const socket = getSocket();
    if (socket) {
      socket.emit('quiz:end');
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
    if (gameState === 'quiz-active' && currentQuiz) {
      return (
        <IntegratedQuizGame
          quiz={currentQuiz}
          currentUser={currentUser}
          users={room.users}
          isHost={isHost}
          gameState={quizGameState}
          scores={scores}
          buzzedUser={buzzedUser}
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

  // Regular room lobby view
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <div className="lg:col-span-1">
          <PlayerList
            users={room.users}
            currentUserId={currentUserId}
            isHost={isHost}
            onMakeHost={handleMakeHost}
          />
        </div>

        {/* Chat and Game Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chat */}
          <Chat
            roomName={room.name}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />

          {/* Game Area */}
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