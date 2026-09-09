/** @vitest-environment jsdom
 * Verifies handshake ordering and reconnect safety without relying on React render timing.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { JoinResponse, RoomStateEvent } from '@quiz-world/shared';
import { createSocket } from '../socket/client';
import { useRoomSocket, type RoomJoinRequest } from './useRoomSocket';

vi.mock('../socket/client', () => ({ createSocket: vi.fn() }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function setup(
  request: RoomJoinRequest = { kind: 'participant', tournamentId: 't1', displayName: '太郎' },
) {
  const listeners = new Map<string, Set<(...args: never[]) => void>>();
  const socket = {
    connected: false,
    on: vi.fn((event: string, handler: (...args: never[]) => void) => {
      const handlers = listeners.get(event) ?? new Set();
      handlers.add(handler);
      listeners.set(event, handlers);
    }),
    off: vi.fn((event: string, handler: (...args: never[]) => void) =>
      listeners.get(event)?.delete(handler),
    ),
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn<(...args: unknown[]) => void>(),
  };
  vi.mocked(createSocket).mockReturnValue(socket as unknown as ReturnType<typeof createSocket>);
  const fire = (event: string, ...args: unknown[]) =>
    act(() => {
      if (event === 'connect') socket.connected = true;
      if (event === 'disconnect') socket.connected = false;
      for (const handler of listeners.get(event) ?? []) handler(...(args as never[]));
    });
  const ack = (response: JoinResponse) =>
    act(() => {
      const callback = socket.emit.mock.lastCall?.[2] as (response: JoinResponse) => void;
      callback(response);
    });
  const hook = renderHook(() => useRoomSocket(request));
  return { ...hook, socket, fire, ack };
}
const success: JoinResponse = {
  ok: true,
  role: 'participant',
  participantId: 'p1',
  isReconnect: false,
};
const state: RoomStateEvent = {
  tournamentId: 't1',
  status: 'idle',
  hostId: 'h',
  hostOnline: true,
  participants: [],
  buzzOrder: [],
  updatedAt: 1,
};

it('requires ack and fresh state on every connection and reuses the issued id', () => {
  const { result, socket, fire, ack } = setup();
  fire('connect');
  ack(success);
  expect(result.current.status).toBe('connecting');
  fire('room:state', state);
  expect(result.current.status).toBe('joined');
  fire('disconnect');
  expect(result.current.roomState).toEqual(state);
  expect(result.current.status).toBe('connecting');
  const count = socket.emit.mock.calls.length;
  act(() => {
    result.current.buzz();
    result.current.finishTournament();
    result.current.closeRoom();
    result.current.submitAnswer('回答');
    result.current.resetGame();
  });
  expect(socket.emit).toHaveBeenCalledTimes(count);
  fire('connect');
  expect(socket.emit.mock.lastCall?.[1]).toMatchObject({ participantId: 'p1' });
  fire('room:state', { ...state, updatedAt: 2 });
  expect(result.current.status).toBe('connecting');
  ack(success);
  expect(result.current.status).toBe('joined');
});

it('keeps a dropped handshake ack from enabling the next connection', () => {
  const { result, socket, fire, ack } = setup();
  fire('connect');
  const oldAck = socket.emit.mock.lastCall?.[2] as (response: JoinResponse) => void;
  fire('disconnect');
  fire('connect');
  fire('room:state', state);
  act(() => oldAck(success));
  expect(result.current.status).toBe('connecting');
  ack(success);
  expect(result.current.status).toBe('joined');
});

it.each(['session:invalidated', 'room:closed'])('stops sending after %s', (event) => {
  const { result, socket, fire, ack } = setup();
  fire('connect');
  ack(success);
  fire('room:state', state);
  fire(event, {});
  const count = socket.emit.mock.calls.length;
  act(() => result.current.buzz());
  expect(socket.emit).toHaveBeenCalledTimes(count);
  expect(socket.disconnect).toHaveBeenCalled();
  expect(result.current.status).not.toBe('joined');
});

it('rejoins hosts and stops all gameplay sends until the new handshake completes', () => {
  const { result, socket, fire, ack } = setup({
    kind: 'host',
    tournamentId: 't1',
    hostToken: 'secret',
  });
  fire('connect');
  expect(socket.emit.mock.lastCall?.slice(0, 2)).toEqual([
    'tournament:host-join',
    { tournamentId: 't1', hostToken: 'secret' },
  ]);
  ack(success);
  fire('room:state', state);
  act(() => {
    result.current.judge({
      participantId: 'p1',
      isCorrect: true,
      scoreDelta: 1,
      nextAction: 'showResult',
    });
    result.current.resetGame();
    result.current.finishTournament();
    result.current.closeRoom();
    result.current.submitAnswer('回答');
  });
  expect(socket.emit.mock.calls.map((call) => call[0])).toEqual([
    'tournament:host-join',
    'judge:submit',
    'game:reset',
    'tournament:finish',
    'room:close',
    'answer:submit',
  ]);
  fire('disconnect');
  fire('connect_error');
  expect(result.current.roomState).toEqual(state);
  expect(result.current.errorMessage).toBe('サーバーに再接続しています…');
  fire('connect');
  expect(socket.emit.mock.lastCall?.[0]).toBe('tournament:host-join');
});

it('surfaces a rejected rejoin and never enables gameplay from a late state', () => {
  const { result, socket, fire, ack } = setup();
  fire('connect');
  ack({ ok: false, code: 'TOURNAMENT_NOT_JOINABLE', message: '参加できません' });
  fire('room:state', state);
  expect(result.current.status).toBe('error');
  expect(result.current.errorMessage).toBe('参加できません');
  expect(socket.disconnect).toHaveBeenCalledOnce();
});

it('forwards server errors and makes leaving terminal for gameplay', () => {
  const { result, socket, fire, ack } = setup();
  fire('connect');
  ack(success);
  fire('room:state', state);
  fire('error', { code: 'INVALID_STATE', message: '状態エラー' });
  expect(result.current.socketError?.message).toBe('状態エラー');
  act(() => result.current.clearSocketError());
  expect(result.current.socketError).toBeUndefined();
  act(() => result.current.leave());
  expect(result.current.errorMessage).toBe('退出しました');
  expect(socket.disconnect).toHaveBeenCalledOnce();
  const count = socket.emit.mock.calls.length;
  act(() => result.current.buzz());
  expect(socket.emit).toHaveBeenCalledTimes(count);
});
