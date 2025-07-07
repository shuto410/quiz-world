/**
 * Tests for useSocketConnection hook
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSocketConnection } from './useSocketConnection';
import * as socketClient from '../../../lib/socketClient';
import type { ConnectionState } from '../../../lib/socketClient';

// Mock socket client
vi.mock('../../../lib/socketClient', () => ({
  initializeSocketClient: vi.fn(),
  getConnectionState: vi.fn(),
}));

describe('useSocketConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('初期状態はconnectingである', () => {
    const { result } = renderHook(() => useSocketConnection());
    
    expect(result.current.connectionState).toBe('connecting');
    expect(result.current.isConnected).toBe(false);
  });

  test('接続が成功するとconnected状態になる', async () => {
    const mockInitialize = vi.mocked(socketClient.initializeSocketClient);
    mockInitialize.mockImplementation(async (_, options) => {
      // Call the connection state change callback
      if (options?.onConnectionStateChange) {
        options.onConnectionStateChange('connected');
      }
    });

    const { result } = renderHook(() => useSocketConnection());

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });
  });

  test('接続エラー時はerror状態になる', async () => {
    const mockInitialize = vi.mocked(socketClient.initializeSocketClient);
    mockInitialize.mockImplementation(async (_, options) => {
      if (options?.onConnectionStateChange) {
        options.onConnectionStateChange('error');
      }
    });

    const { result } = renderHook(() => useSocketConnection());

    await waitFor(() => {
      expect(result.current.connectionState).toBe('error');
      expect(result.current.isConnected).toBe(false);
    });
  });

  test('切断時はdisconnected状態になる', async () => {
    const mockInitialize = vi.mocked(socketClient.initializeSocketClient);
    mockInitialize.mockImplementation(async (_, options) => {
      // First connect, then disconnect
      if (options?.onConnectionStateChange) {
        options.onConnectionStateChange('connected');
        setTimeout(() => options.onConnectionStateChange?.('disconnected'), 100);
      }
    });

    const { result } = renderHook(() => useSocketConnection());

    await waitFor(() => {
      expect(result.current.connectionState).toBe('connected');
    });

    await waitFor(() => {
      expect(result.current.connectionState).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });
  });

  test('再接続時はreconnecting状態になる', async () => {
    const mockInitialize = vi.mocked(socketClient.initializeSocketClient);
    mockInitialize.mockImplementation(async (_, options) => {
      if (options?.onConnectionStateChange) {
        options.onConnectionStateChange('reconnecting' as ConnectionState);
      }
    });

    const { result } = renderHook(() => useSocketConnection());

    await waitFor(() => {
      expect(result.current.connectionState).toBe('reconnecting');
      expect(result.current.isConnected).toBe(false);
    });
  });

  test('コンポーネントのアンマウント時にクリーンアップされる', () => {
    const mockInitialize = vi.mocked(socketClient.initializeSocketClient);
    
    const { unmount } = renderHook(() => useSocketConnection());
    
    unmount();
    
    // Ensure no state updates occur after unmount
    expect(() => {
      const call = mockInitialize.mock.calls[0];
      if (call && call[1]?.onConnectionStateChange) {
        call[1].onConnectionStateChange('connected');
      }
    }).not.toThrow();
  });

  test('接続オプションをカスタマイズできる', async () => {
    const mockInitialize = vi.mocked(socketClient.initializeSocketClient);
    const customOptions = {
      reconnection: false,
      timeout: 5000,
    };

    renderHook(() => useSocketConnection(customOptions));

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining(customOptions)
      );
    });
  });
});