/**
 * Socket handlers for joining and leaving a tournament room.
 *
 * I/O stays here: load the tournament, verify the host token, join Socket.io channels, and
 * acknowledge. The capacity / name / reconnect decisions are pure functions in `domain/join`,
 * applied through `RoomRegistry.update()` so that nothing awaits between reading and writing
 * the room state.
 *
 * State leaves this module only via `broadcastRoomState()`. Failed joins ack a code and
 * never receive a `room:state`, so a refused client cannot learn who is already inside.
 */

import type {
  AckFailure,
  ClientToServerEvents,
  JoinResponse,
  ServerToClientEvents,
  TournamentHostJoinPayload,
  TournamentJoinPayload,
} from '@quiz-world/shared';
import { validateDisplayName } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import {
  applyHostJoin,
  applyLeave,
  applyParticipantJoin,
  createInitialRoomState,
} from '../domain/join';
import { accept, reject } from '../domain/transition';
import { isRecord } from '../guards';
import type { Logger } from '../logger';
import type { RoomRegistry } from '../rooms/roomRegistry';
import { hashHostToken } from '../tournaments/hostToken';
import type { TournamentRepository } from '../tournaments/repository';
import {
  broadcastRoomState,
  hostChannel,
  participantChannel,
  type SocketServer,
} from './broadcast';
import type { Connections } from './connections';
import { socketErrorMessage } from './errorMessages';
import { clearSession, readSession } from './session';

/** Services and transport ownership needed to admit or detach a seat. */
export type JoinHandlerDependencies = {
  connections: Connections;
  io: SocketServer;
  registry: RoomRegistry;
  repository: TournamentRepository;
  newParticipantId: () => string;
  now: () => number;
  logger: Logger;
};

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** Registers join / leave handlers on a newly connected socket. */
export function registerJoinHandlers(
  socket: AppSocket,
  dependencies: JoinHandlerDependencies,
): void {
  socket.use(([, ...args], next) => {
    if (!dependencies.connections.isInvalidated(socket)) {
      next();
      return;
    }
    const error = failure('STALE_CONNECTION');
    const ack: unknown = args.at(-1);
    if (typeof ack === 'function') (ack as (response: AckFailure) => void)(error);
    else socket.emit('error', { code: error.code, message: error.message });
  });
  socket.on('disconnect', () => handleLeave(socket, dependencies));
  socket.on('tournament:host-join', (payload, ack) => {
    void handleHostJoin(socket, dependencies, payload, ack);
  });

  socket.on('tournament:join', (payload, ack) => {
    void handleParticipantJoin(socket, dependencies, payload, ack);
  });

  socket.on('tournament:leave', () => {
    handleLeave(socket, dependencies);
  });
}

async function handleHostJoin(
  socket: AppSocket,
  dependencies: JoinHandlerDependencies,
  payload: TournamentHostJoinPayload,
  ack: (response: JoinResponse) => void,
): Promise<void> {
  const parsed = parseHostJoinPayload(payload);
  if (!parsed.ok) {
    ack(failure('VALIDATION_ERROR'));
    return;
  }

  if (
    (socket.data as Record<string, unknown>)['joining'] === true ||
    readSession(socket.data) !== undefined
  ) {
    ack(failure('INVALID_STATE'));
    return;
  }
  (socket.data as Record<string, unknown>)['joining'] = true;
  const wasOwned = dependencies.registry.find(parsed.tournamentId) !== undefined;
  try {
    const record = await dependencies.repository.findById(parsed.tournamentId);
    if (!socket.connected) return;
    if (wasOwned && dependencies.registry.find(parsed.tournamentId) === undefined) {
      ack(failure('TOURNAMENT_NOT_JOINABLE'));
      return;
    }
    if (record === undefined) {
      ack(failure('TOURNAMENT_NOT_FOUND'));
      return;
    }

    if (hashHostToken(parsed.hostToken) !== record.hostTokenHash) {
      ack(failure('UNAUTHORIZED'));
      return;
    }

    // A closed tournament needs an existing room; never resurrect an empty playing room.
    if (
      record.status === 'closed' &&
      dependencies.registry.find(parsed.tournamentId) === undefined
    ) {
      ack(failure('TOURNAMENT_NOT_JOINABLE'));
      return;
    }

    const { registry, now, newParticipantId, io } = dependencies;
    const handle = registry.claim(
      parsed.tournamentId,
      createInitialRoomState(parsed.tournamentId, now()),
    );

    let joined: { participantId: string; isReconnect: boolean } | undefined;
    const transition = handle.update((current) => {
      const outcome = applyHostJoin(current, {
        newParticipantId: newParticipantId(),
        now: now(),
      });
      if (!outcome.ok) {
        return reject(outcome.code);
      }
      joined = {
        participantId: outcome.participantId,
        isReconnect: outcome.isReconnect,
      };
      return accept(outcome.state);
    });

    if (!transition.ok || joined === undefined) {
      ack(failure(transition.ok ? 'INTERNAL_ERROR' : transition.code));
      return;
    }

    dependencies.connections.bind(socket, {
      tournamentId: parsed.tournamentId,
      participantId: joined.participantId,
      role: 'host',
    });

    ack({
      ok: true,
      role: 'host',
      participantId: joined.participantId,
      isReconnect: joined.isReconnect,
    });
    broadcastRoomState(io, handle);
  } catch (error: unknown) {
    dependencies.logger.error('host join failed', { error, socketId: socket.id });
    ack(failure('INTERNAL_ERROR'));
  } finally {
    (socket.data as Record<string, unknown>)['joining'] = false;
  }
}

async function handleParticipantJoin(
  socket: AppSocket,
  dependencies: JoinHandlerDependencies,
  payload: TournamentJoinPayload,
  ack: (response: JoinResponse) => void,
): Promise<void> {
  const parsed = parseParticipantJoinPayload(payload);
  if (!parsed.ok) {
    ack(failure(parsed.code, parsed.message));
    return;
  }

  if (
    (socket.data as Record<string, unknown>)['joining'] === true ||
    readSession(socket.data) !== undefined
  ) {
    ack(failure('INVALID_STATE'));
    return;
  }
  (socket.data as Record<string, unknown>)['joining'] = true;
  const wasOwned = dependencies.registry.find(parsed.tournamentId) !== undefined;
  try {
    const record = await dependencies.repository.findById(parsed.tournamentId);
    if (!socket.connected) return;
    if (wasOwned && dependencies.registry.find(parsed.tournamentId) === undefined) {
      ack(failure('TOURNAMENT_NOT_JOINABLE'));
      return;
    }
    if (record === undefined) {
      ack(failure('TOURNAMENT_NOT_FOUND'));
      return;
    }

    if (
      record.status === 'closed' &&
      dependencies.registry.find(parsed.tournamentId) === undefined
    ) {
      ack(failure('TOURNAMENT_NOT_JOINABLE'));
      return;
    }

    const { registry, now, newParticipantId, io } = dependencies;
    const handle = registry.claim(
      parsed.tournamentId,
      createInitialRoomState(parsed.tournamentId, now()),
    );

    let joined: { participantId: string; isReconnect: boolean } | undefined;
    const transition = handle.update((current) => {
      const outcome = applyParticipantJoin(current, {
        displayName: parsed.displayName,
        claimedParticipantId: parsed.claimedParticipantId,
        newParticipantId: newParticipantId(),
        now: now(),
        maxParticipants: record.maxParticipants,
        tournamentStatus: record.status,
      });
      if (!outcome.ok) {
        return reject(outcome.code);
      }
      joined = {
        participantId: outcome.participantId,
        isReconnect: outcome.isReconnect,
      };
      return accept(outcome.state);
    });

    if (!transition.ok || joined === undefined) {
      ack(failure(transition.ok ? 'INTERNAL_ERROR' : transition.code));
      return;
    }

    dependencies.connections.bind(socket, {
      tournamentId: parsed.tournamentId,
      participantId: joined.participantId,
      role: 'participant',
    });

    ack({
      ok: true,
      role: 'participant',
      participantId: joined.participantId,
      isReconnect: joined.isReconnect,
    });
    broadcastRoomState(io, handle);
  } catch (error: unknown) {
    dependencies.logger.error('participant join failed', { error, socketId: socket.id });
    ack(failure('INTERNAL_ERROR'));
  } finally {
    (socket.data as Record<string, unknown>)['joining'] = false;
  }
}

function handleLeave(socket: AppSocket, dependencies: JoinHandlerDependencies): void {
  const session = readSession(socket.data);
  if (session === undefined) {
    return;
  }

  if (!dependencies.connections.release(socket, session)) return;

  const handle = dependencies.registry.find(session.tournamentId);
  if (handle === undefined) {
    clearSession(socket.data as Record<string, unknown>);
    void socket.leave(hostChannel(session.tournamentId));
    void socket.leave(participantChannel(session.tournamentId));
    return;
  }

  handle.update((current) => applyLeave(current, session.participantId, dependencies.now()));

  void socket.leave(hostChannel(session.tournamentId));
  void socket.leave(participantChannel(session.tournamentId));
  clearSession(socket.data as Record<string, unknown>);
  broadcastRoomState(dependencies.io, handle);
}

function failure(code: AckFailure['code'], message: string = socketErrorMessage(code)): AckFailure {
  return { ok: false, code, message };
}

function parseHostJoinPayload(
  payload: TournamentHostJoinPayload,
): { ok: true; tournamentId: string; hostToken: string } | { ok: false } {
  if (!isRecord(payload)) {
    return { ok: false };
  }
  const tournamentId = payload['tournamentId'];
  const hostToken = payload['hostToken'];
  if (
    typeof tournamentId !== 'string' ||
    tournamentId === '' ||
    typeof hostToken !== 'string' ||
    hostToken === ''
  ) {
    return { ok: false };
  }
  return { ok: true, tournamentId, hostToken };
}

function parseParticipantJoinPayload(payload: TournamentJoinPayload):
  | {
      ok: true;
      tournamentId: string;
      displayName: string;
      claimedParticipantId: string | undefined;
    }
  | { ok: false; code: 'VALIDATION_ERROR'; message: string } {
  if (!isRecord(payload)) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: socketErrorMessage('VALIDATION_ERROR'),
    };
  }

  const tournamentId = payload['tournamentId'];
  if (typeof tournamentId !== 'string' || tournamentId === '') {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: socketErrorMessage('VALIDATION_ERROR'),
    };
  }

  const displayName = validateDisplayName(payload['displayName']);
  if (!displayName.ok) {
    return { ok: false, code: 'VALIDATION_ERROR', message: displayName.message };
  }

  const claimed = payload['participantId'];
  const claimedParticipantId = typeof claimed === 'string' && claimed !== '' ? claimed : undefined;

  return {
    ok: true,
    tournamentId,
    displayName: displayName.value,
    claimedParticipantId,
  };
}
