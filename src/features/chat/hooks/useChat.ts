/**
 * Hook for managing chat messages
 */
import { useState, useCallback, useEffect } from 'react';
import { getSocket, sendChatMessage } from '@/lib/socketClient';

/**
 * Generate a unique message ID with timestamp and random entropy
 */
const generateMessageId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  type: 'user' | 'system';
}

export interface UseChatOptions {
  roomName?: string;
  maxMessages?: number;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  messageCount: number;
  sendMessage: (message: string, userId: string, userName: string) => void;
  addSystemMessage: (message: string) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { roomName, maxMessages } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => {
      const newMessages = [...prev, message];
      
      // Limit messages if maxMessages is set
      if (maxMessages && newMessages.length > maxMessages) {
        return newMessages.slice(-maxMessages);
      }
      
      return newMessages;
    });
  }, [maxMessages]);

  const addSystemMessage = useCallback((message: string) => {
    addMessage({
      id: generateMessageId(),
      userId: 'system',
      userName: 'System',
      message,
      timestamp: Date.now(),
      type: 'system',
    });
  }, [addMessage]);

  const sendMessage = useCallback((message: string, userId: string, userName: string) => {
    if (!message.trim()) return;

    try {
      // Send message via Socket.io
      sendChatMessage(message.trim(), userId, userName);
    } catch (error) {
      console.error('Failed to send chat message:', error);
      // Show error to user instead of silent fallback
      addSystemMessage('Failed to send message. Please check your connection and try again.');
    }
  }, [addSystemMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Add welcome message if roomName is provided
  useEffect(() => {
    if (roomName) {
      setMessages([{
        id: 'welcome',
        userId: 'system',
        userName: 'System',
        message: `Welcome to ${roomName}! The game will begin soon.`,
        timestamp: Date.now(),
        type: 'system',
      }]);
    }
  }, [roomName]);

  // Set up Socket.io listeners for real-time chat
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleChatMessage = (data: { message: string; userId: string; userName: string; timestamp: number }) => {
      // Validate incoming data
      if (!data.message || !data.userId || !data.userName || !data.timestamp) {
        console.warn('Invalid chat message data received:', data);
        return;
      }

      addMessage({
        id: `${data.userId}-${data.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        userId: data.userId,
        userName: data.userName,
        message: data.message,
        timestamp: data.timestamp,
        type: 'user',
      });
    };

    socket.on('chat:message', handleChatMessage);

    return () => {
      socket.off('chat:message', handleChatMessage);
    };
  }, [addMessage]);

  return {
    messages,
    messageCount: messages.length,
    sendMessage,
    addSystemMessage,
    addMessage,
    clearMessages,
  };
}