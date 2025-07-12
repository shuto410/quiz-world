/**
 * Tests for useChat hook
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should initialize with empty messages', () => {
    const { result } = renderHook(() => useChat());
    
    expect(result.current.messages).toEqual([]);
  });

  test('should add user message', () => {
    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.sendMessage('Hello world', 'user1', 'User 1');
    });
    
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      userId: 'user1',
      userName: 'User 1',
      message: 'Hello world',
      type: 'user',
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
    expect(result.current.messages[0].message).toBe('First message');
    expect(result.current.messages[1].message).toBe('Second message');
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
    expect(result.current.messages[0].message).toBe('Message 2');
    expect(result.current.messages[1].message).toBe('Message 3');
    expect(result.current.messages[2].message).toBe('Message 4');
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
});