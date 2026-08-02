/**
 * Tests for the Socket.io client defaults.
 *
 * The interesting behaviour — reconnecting after a drop, recovering state from `room:state`
 * — needs a live server and lands in later steps. What this step can pin is the policy:
 * reconnect is on, attempts are unbounded, and the socket does not connect until a screen
 * asks it to.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { SOCKET_CLIENT_OPTIONS, createSocket, type AppSocket } from './client';

let socket: AppSocket | undefined;

afterEach(() => {
  socket?.disconnect();
  socket = undefined;
});

describe('SOCKET_CLIENT_OPTIONS', () => {
  it('does not connect until a screen asks, so the create form stays quiet', () => {
    expect(SOCKET_CLIENT_OPTIONS.autoConnect).toBe(false);
  });

  it('reconnects without a capped attempt count', () => {
    expect(SOCKET_CLIENT_OPTIONS.reconnection).toBe(true);
    expect(SOCKET_CLIENT_OPTIONS.reconnectionAttempts).toBe(Number.POSITIVE_INFINITY);
  });

  it('backs off between attempts up to five seconds', () => {
    expect(SOCKET_CLIENT_OPTIONS.reconnectionDelay).toBe(1_000);
    expect(SOCKET_CLIENT_OPTIONS.reconnectionDelayMax).toBe(5_000);
  });

  it('prefers WebSocket with polling as a fallback', () => {
    expect(SOCKET_CLIENT_OPTIONS.transports).toEqual(['websocket', 'polling']);
  });
});

describe('createSocket', () => {
  it('applies the shared options to the manager', () => {
    socket = createSocket({ url: 'http://127.0.0.1:9' });

    expect(socket.io.opts.autoConnect).toBe(false);
    expect(socket.io.opts.reconnection).toBe(true);
    expect(socket.io.opts.reconnectionAttempts).toBe(Number.POSITIVE_INFINITY);
    expect(socket.connected).toBe(false);
  });

  it('uses the default /socket.io path so Vite or CloudFront can proxy it', () => {
    socket = createSocket();

    expect(socket.io.opts.path).toBe('/socket.io');
  });
});
