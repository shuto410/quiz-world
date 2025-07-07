/**
 * Hook for managing chat messages
 */
import { useState, useCallback, useEffect } from 'react';

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

  const sendMessage = useCallback((message: string, userId: string, userName: string) => {
    if (!message.trim()) return;

    addMessage({
      id: Date.now().toString(),
      userId,
      userName,
      message: message.trim(),
      timestamp: Date.now(),
      type: 'user',
    });
  }, [addMessage]);

  const addSystemMessage = useCallback((message: string) => {
    addMessage({
      id: Date.now().toString(),
      userId: 'system',
      userName: 'System',
      message,
      timestamp: Date.now(),
      type: 'system',
    });
  }, [addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    messageCount: messages.length,
    sendMessage,
    addSystemMessage,
    addMessage,
    clearMessages,
  };
}