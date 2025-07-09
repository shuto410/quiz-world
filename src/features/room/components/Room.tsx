/**
 * Refactored Room component for Quiz World application
 * - Split into smaller, focused components
 * - Uses custom hooks for chat management
 * - Maintains anime pop style design
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { QuizCreator } from '@/features/quiz/components/QuizCreator';
import type { Room, User, Quiz } from '@/types';
import { leaveRoom, transferHost, startQuiz } from '@/lib/socketClient';
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
 * Game status component
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
 * Room props interface
 */
export interface RoomProps {
  room: Room;
  currentUser: User;
  onLeave?: () => void;
  className?: string;
}

/**
 * Refactored Room component
 */
export function Room({ room, currentUser, onLeave, className }: RoomProps) {
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [showQuizCreator, setShowQuizCreator] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roomQuizzes, setRoomQuizzes] = useState(room.quizzes);

  const isHost = currentUser.isHost;
  const currentUserName = getUserName() || currentUser.name;
  const currentUserId = getUserId();

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
    } catch (error) {
      console.error('Failed to start quiz:', error);
    }
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
  const handleQuizCreated = (quiz: Quiz) => {
    console.log('Quiz created:', quiz);
    setRoomQuizzes(prev => [...prev, quiz]);
    setShowQuizCreator(false);
  };

  return (
    <div className={className} data-testid="room-component">
      {/* Room Header */}
      <RoomHeader 
        room={room}
        isHost={isHost}
        onManageQuizzes={() => setShowQuizModal(true)}
        onLeave={handleLeaveRoom}
      />

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

          {/* Game Status */}
          <GameStatus
            isHost={isHost}
            hasQuizzes={roomQuizzes.length > 0}
            onManageQuizzes={() => setShowQuizModal(true)}
          />
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