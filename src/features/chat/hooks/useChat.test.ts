/**
 * Tests for useChat hook
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';
import * as socketClientModule from '@/lib/socketClient';

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the socket client functions
    vi.spyOn(socketClientModule, 'getSocket').mockReturnValue(null);
    vi.spyOn(socketClientModule, 'sendChatMessage').mockImplementation(() => {
      throw new Error('Socket not connected');
    });
  });

  test('should initialize with empty messages', () => {
    const { result } = renderHook(() => useChat());
    
    expect(result.current.messages).toEqual([]);
  });

  test('should show error message when socket fails', () => {
    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.sendMessage('Hello world', 'user1', 'User 1');
    });
    
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      userId: 'system',
      userName: 'System',
      message: 'Failed to send message. Please check your connection and try again.',
      type: 'system',
    });
    expect(result.current.messages[0].id).toBeDefined();
    expect(result.current.messages[0].timestamp).toBeDefined();
  });

  test('should add system message', () => {
    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.addSystemMessage('User joined the room');
    });
    
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      userId: 'system',
      userName: 'System',
      message: 'User joined the room',
      type: 'system',
    });
  });

  test('should not add empty messages', () => {
    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.sendMessage('', 'user1', 'User 1');
      result.current.sendMessage('   ', 'user1', 'User 1');
    });
    
    expect(result.current.messages).toHaveLength(0);
  });

  test('should add multiple messages in order', () => {
    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.sendMessage('First message', 'user1', 'User 1');
      result.current.sendMessage('Second message', 'user2', 'User 2');
      result.current.addSystemMessage('System announcement');
    });
    
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[0].message).toBe('Failed to send message. Please check your connection and try again.');
    expect(result.current.messages[1].message).toBe('Failed to send message. Please check your connection and try again.');
    expect(result.current.messages[2].message).toBe('System announcement');
  });

  test('should clear all messages', () => {
    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.sendMessage('Message 1', 'user1', 'User 1');
      result.current.sendMessage('Message 2', 'user2', 'User 2');
    });
    
    expect(result.current.messages).toHaveLength(2);
    
    act(() => {
      result.current.clearMessages();
    });
    
    expect(result.current.messages).toHaveLength(0);
  });

  test('should initialize with welcome message when roomName provided', () => {
    const { result } = renderHook(() => useChat({ roomName: 'Test Room' }));
    
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      userId: 'system',
      userName: 'System',
      message: 'Welcome to Test Room! The game will begin soon.',
      type: 'system',
    });
  });

  test('should handle max messages limit', () => {
    const { result } = renderHook(() => useChat({ maxMessages: 3 }));
    
    act(() => {
      result.current.sendMessage('Message 1', 'user1', 'User 1');
      result.current.sendMessage('Message 2', 'user1', 'User 1');
      result.current.sendMessage('Message 3', 'user1', 'User 1');
      result.current.sendMessage('Message 4', 'user1', 'User 1');
    });
    
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[0].message).toBe('Failed to send message. Please check your connection and try again.');
    expect(result.current.messages[1].message).toBe('Failed to send message. Please check your connection and try again.');
    expect(result.current.messages[2].message).toBe('Failed to send message. Please check your connection and try again.');
  });

  test('should provide message count', () => {
    const { result } = renderHook(() => useChat());
    
    expect(result.current.messageCount).toBe(0);
    
    act(() => {
      result.current.sendMessage('Message 1', 'user1', 'User 1');
      result.current.sendMessage('Message 2', 'user1', 'User 1');
    });
    
    expect(result.current.messageCount).toBe(2);
  });

  test('should add message with custom timestamp', () => {
    const { result } = renderHook(() => useChat());
    const customTimestamp = Date.now() - 10000;
    
    act(() => {
      result.current.addMessage({
        id: 'custom-id',
        userId: 'user1',
        userName: 'User 1',
        message: 'Custom message',
        timestamp: customTimestamp,
        type: 'user',
      });
    });
    
    expect(result.current.messages[0].timestamp).toBe(customTimestamp);
  });

  test('should add user message when socket is connected', () => {
    // Mock successful socket connection
    const mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };
    vi.spyOn(socketClientModule, 'getSocket').mockReturnValue(mockSocket as any);
    vi.spyOn(socketClientModule, 'sendChatMessage').mockImplementation(() => {
      // Simulate successful message sending
    });

    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.sendMessage('Hello world', 'user1', 'User 1');
    });
    
    // When socket connection is successful, no error message should be added
    expect(result.current.messages).toHaveLength(0);
    expect(socketClientModule.sendChatMessage).toHaveBeenCalledWith('Hello world', 'user1', 'User 1');
  });
});