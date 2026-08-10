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
import { socketErrorMessage } from './errorMessages';
import { bindSession, clearSession, readSession } from './session';

export type JoinHandlerDependencies = {
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

  try {
    const record = await dependencies.repository.findById(parsed.tournamentId);
    if (record === undefined) {
      ack(failure('TOURNAMENT_NOT_FOUND'));
      return;
    }

    if (hashHostToken(parsed.hostToken) !== record.hostTokenHash) {
      ack(failure('UNAUTHORIZED'));
      return;
    }

    // Host may reconnect to a closed tournament to view the final result; no status gate here.

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

    await moveToChannel(socket, parsed.tournamentId, 'host');
    bindSession(socket.data as Record<string, unknown>, {
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

  try {
    const record = await dependencies.repository.findById(parsed.tournamentId);
    if (record === undefined) {
      ack(failure('TOURNAMENT_NOT_FOUND'));
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

    await moveToChannel(socket, parsed.tournamentId, 'participant');
    bindSession(socket.data as Record<string, unknown>, {
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
  }
}

function handleLeave(socket: AppSocket, dependencies: JoinHandlerDependencies): void {
  const session = readSession(socket.data);
  if (session === undefined) {
    return;
  }

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

async function moveToChannel(
  socket: AppSocket,
  tournamentId: string,
  role: 'host' | 'participant',
): Promise<void> {
  await socket.leave(hostChannel(tournamentId));
  await socket.leave(participantChannel(tournamentId));
  await socket.join(role === 'host' ? hostChannel(tournamentId) : participantChannel(tournamentId));
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
