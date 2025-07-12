/**
 * Chat component for Quiz World application
 * - Compact chat interface for room sidebar
 * - Real-time message display and sending
 * - Optimized for small space in sidebar layout
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useChat } from '@/features/chat/hooks/useChat';

/**
 * Chat component props
 */
interface ChatProps {
  roomName: string;
  currentUserId: string;
  currentUserName: string;
}

/**
 * Individual chat message props
 */
interface ChatMessageProps {
  message: {
    id: string;
    userName: string;
    message: string;
    type: 'user' | 'system';
  };
}

/**
 * Individual chat message component - compact design
 */
function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div
      className={`flex gap-1 text-sm ${
        message.type === 'system' ? 'justify-center' : ''
      }`}
    >
      {message.type === 'user' && (
        <span className="font-medium text-pink-600 text-xs">
          {message.userName}:
        </span>
      )}
      <span
        className={`${
          message.type === 'system'
            ? 'text-gray-500 italic text-xs'
            : 'text-gray-700 text-xs'
        }`}
      >
        {message.message}
      </span>
    </div>
  );
}

/**
 * Chat component using useChat hook - optimized for sidebar
 */
export function Chat({ roomName, currentUserId, currentUserName }: ChatProps) {
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
        <h2 className="text-sm font-semibold text-gray-800">Chat</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Messages - compact design */}
          <div className="h-32 overflow-y-auto space-y-1">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
          </div>

          {/* Message Input - compact design */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
            <Button size="sm" onClick={handleSendMessage} disabled={!newMessage.trim()}>
              Send
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 