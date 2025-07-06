/**
 * Room component for Quiz World application
 * - Displays room information and user list
 * - Shows chat messages and real-time updates
 * - Provides host controls for quiz management
 * - Follows anime pop style design
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import type { Room, User, Quiz } from '../types';
import { leaveRoom, transferHost } from '../lib/socketClient';
import { getUserName } from '../lib/userStorage';

/**
 * Room props interface
 */
export interface RoomProps {
  room: Room;
  currentUser: User;
  onLeave?: () => void;
  onQuizStart?: (quiz: Quiz) => void;
  className?: string;
}

/**
 * Chat message interface
 */
interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  type: 'user' | 'system';
}

/**
 * Room component with anime pop style
 */
export function Room({ room, currentUser, onLeave, onQuizStart, className }: RoomProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const isHost = currentUser.isHost;
  const currentUserName = getUserName() || currentUser.name;

  // Add welcome message
  useEffect(() => {
    setChatMessages([
      {
        id: 'welcome',
        userId: 'system',
        userName: 'System',
        message: `Welcome to ${room.name}! The game will begin soon.`,
        timestamp: Date.now(),
        type: 'system',
      },
    ]);
  }, [room.name]);

  /**
   * Handle leaving the room
   */
  const handleLeaveRoom = () => {
    leaveRoom();
    onLeave?.();
  };

  /**
   * Send chat message
   */
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUserName,
      message: newMessage.trim(),
      timestamp: Date.now(),
      type: 'user',
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
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
    onQuizStart?.(quiz);
    setShowQuizModal(false);
  };

  return (
    <div className={className}>
      {/* Room Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{room.name}</h1>
          <p className="text-gray-600">
            {room.users.length}/{room.maxPlayers} players
            {room.isPublic && ' • Public Room'}
          </p>
        </div>
        <div className="flex gap-2">
          {isHost && (
            <Button variant="secondary" onClick={() => setShowQuizModal(true)}>
              Manage Quizzes
            </Button>
          )}
          <Button variant="danger" onClick={handleLeaveRoom}>
            Leave Room
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User List */}
        <Card variant="elevated" className="lg:col-span-1">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-800">Players</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {room.users.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                    user.id === currentUser.id
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
                    {user.id === currentUser.id && (
                      <span className="text-xs bg-pink-200 text-pink-800 px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  {isHost && !user.isHost && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowHostModal(true);
                      }}
                    >
                      Make Host
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat and Game Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chat */}
          <Card variant="elevated">
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-800">Chat</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Messages */}
                <div className="h-64 overflow-y-auto space-y-2">
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
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

          {/* Game Status */}
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
                {isHost && room.quizzes.length > 0 && (
                  <Button onClick={() => setShowQuizModal(true)}>
                    Start Quiz
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quiz Management Modal */}
      <Modal
        isOpen={showQuizModal}
        onClose={() => setShowQuizModal(false)}
        title="Quiz Management"
        size="lg"
      >
        <div className="space-y-4">
          {room.quizzes.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                No quizzes available
              </h3>
              <p className="text-gray-600 mb-4">
                Create some quizzes to start the game!
              </p>
              <Button onClick={() => setShowQuizModal(false)}>
                Create Quiz
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {room.quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <h4 className="font-medium text-gray-800">{quiz.question}</h4>
                    <p className="text-sm text-gray-600">
                      Type: {quiz.type} • Answer: {quiz.answer}
                    </p>
                  </div>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleStartQuiz(quiz)}
                  >
                    Start
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
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
    </div>
  );
} 