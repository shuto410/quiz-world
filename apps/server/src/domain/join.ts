/**
 * Pure join / leave transitions for a tournament room.
 *
 * Capacity, display-name uniqueness and reconnect rules live here so that the socket
 * handlers only do I/O (load the tournament, hash the host token, join channels) and then
 * hand a synchronous transition to `RoomRegistry.update()`. Keeping the rules in one place
 * also means the status-by-event table can grow later without re-deriving who may enter.
 *
 * Clocks and fresh participant ids are arguments, never read from the environment: the
 * domain lint rules reject `Date.now()` and `Math.random()` so that two buzzes (or two
 * joins) cannot interleave inside a transition.
 */

import type {
  InternalRoomState,
  ParticipantState,
  SocketErrorCode,
  TournamentStatus,
} from '@quiz-world/shared';
import { accept, type TransitionResult } from './transition';

/**
 * Display name given to the seat created by `tournament:host-join`.
 *
 * The host-join payload carries no name, so the server picks one. Participants still cannot
 * reuse it: uniqueness is checked against every seat, including this one.
 */
export const DEFAULT_HOST_DISPLAY_NAME = 'ホスト';

/**
 * Outcome of a join transition, including the metadata the acknowledgement needs.
 *
 * Failure carries only a code: a refused joiner must not learn who is already inside, so the
 * ack never includes room state.
 */
export type JoinOutcome =
  | {
      ok: true;
      state: InternalRoomState;
      participantId: string;
      isReconnect: boolean;
    }
  | { ok: false; code: SocketErrorCode };

/** Seeds an empty room the first time anyone claims it in this process. */
export function createInitialRoomState(tournamentId: string, now: number): InternalRoomState {
  return {
    tournamentId,
    status: 'idle',
    hostId: '',
    hostOnline: false,
    participants: [],
    buzzOrder: [],
    updatedAt: now,
  };
}

/**
 * Host connects with a verified token.
 *
 * First visit creates the host seat. Later visits resume that seat (by `hostId`) and, when
 * the room was paused for a host disconnect, restore `statusBeforePause`. Authority that has
 * already moved to another participant via `host:claim` is rejected with `UNAUTHORIZED`.
 */
export function applyHostJoin(
  current: InternalRoomState,
  input: { newParticipantId: string; now: number },
): JoinOutcome {
  const existingHost = findParticipant(current, current.hostId);

  if (existingHost !== undefined) {
    return {
      ok: true,
      participantId: existingHost.id,
      isReconnect: true,
      state: resumeHost(current, existingHost.id, input.now),
    };
  }

  if (isDisplayNameTaken(current.participants, DEFAULT_HOST_DISPLAY_NAME, undefined)) {
    return { ok: false, code: 'DUPLICATE_DISPLAY_NAME' };
  }

  const host: ParticipantState = {
    id: input.newParticipantId,
    name: DEFAULT_HOST_DISPLAY_NAME,
    online: true,
    joinedAt: input.now,
    score: 0,
  };

  return {
    ok: true,
    participantId: host.id,
    isReconnect: false,
    state: {
      ...current,
      hostId: host.id,
      hostOnline: true,
      participants: [...current.participants, host],
      updatedAt: input.now,
    },
  };
}

/**
 * Guest joins with a display name, optionally claiming a previous participant id.
 *
 * A matching claim resumes the seat (capacity is not re-checked). An unknown claim is
 * ignored and a fresh id is issued, so a stale browser cannot block a real newcomer.
 *
 * A finished tournament still takes reconnects, so that the people who played can reopen the
 * final result, but no new seats are created in one.
 */
export function applyParticipantJoin(
  current: InternalRoomState,
  input: {
    displayName: string;
    claimedParticipantId: string | undefined;
    newParticipantId: string;
    now: number;
    maxParticipants: number;
    tournamentStatus: TournamentStatus;
  },
): JoinOutcome {
  if (input.tournamentStatus !== 'active') {
    return { ok: false, code: 'TOURNAMENT_NOT_JOINABLE' };
  }

  const claimed =
    input.claimedParticipantId === undefined
      ? undefined
      : findParticipant(current, input.claimedParticipantId);

  if (claimed !== undefined) {
    if (isDisplayNameTaken(current.participants, input.displayName, claimed.id)) {
      return { ok: false, code: 'DUPLICATE_DISPLAY_NAME' };
    }

    return {
      ok: true,
      participantId: claimed.id,
      isReconnect: true,
      state: {
        ...current,
        participants: current.participants.map((participant) =>
          participant.id === claimed.id
            ? { ...participant, name: input.displayName, online: true }
            : participant,
        ),
        hostOnline: current.hostId === claimed.id ? true : current.hostOnline,
        updatedAt: input.now,
      },
    };
  }

  // Checked against the room as well as the stored tournament: `tournament:finish` writes the
  // closed status to DynamoDB after the room has already finished, so a failed write must not
  // leave a finished room accepting newcomers through the invite code.
  if (current.status === 'finished') {
    return { ok: false, code: 'TOURNAMENT_NOT_JOINABLE' };
  }

  if (current.participants.length >= input.maxParticipants) {
    return { ok: false, code: 'TOURNAMENT_FULL' };
  }

  if (isDisplayNameTaken(current.participants, input.displayName, undefined)) {
    return { ok: false, code: 'DUPLICATE_DISPLAY_NAME' };
  }

  const joiner: ParticipantState = {
    id: input.newParticipantId,
    name: input.displayName,
    online: true,
    joinedAt: input.now,
    score: 0,
  };

  return {
    ok: true,
    participantId: joiner.id,
    isReconnect: false,
    state: {
      ...current,
      participants: [...current.participants, joiner],
      updatedAt: input.now,
    },
  };
}

/**
 * Marks a participant offline without removing their seat or score.
 *
 * Leaving is deliberate and always accepted when the actor is known; an unknown id is a
 * no-op accept so a double-leave cannot surface as an error toast.
 */
export function applyLeave(
  current: InternalRoomState,
  participantId: string,
  now: number,
): TransitionResult {
  const existing = findParticipant(current, participantId);
  if (existing === undefined) {
    return accept(current);
  }

  return accept({
    ...current,
    participants: current.participants.map((participant) =>
      participant.id === participantId ? { ...participant, online: false } : participant,
    ),
    hostOnline: current.hostId === participantId ? false : current.hostOnline,
    updatedAt: now,
  });
}

function resumeHost(
  current: InternalRoomState,
  hostParticipantId: string,
  now: number,
): InternalRoomState {
  const participants = current.participants.map((participant) =>
    participant.id === hostParticipantId ? { ...participant, online: true } : participant,
  );

  if (current.status === 'paused' && current.statusBeforePause !== undefined) {
    const { statusBeforePause, pausedReason, ...rest } = current;
    return {
      ...rest,
      status: statusBeforePause,
      hostOnline: true,
      participants,
      updatedAt: now,
    };
  }

  return {
    ...current,
    hostOnline: true,
    participants,
    updatedAt: now,
  };
}

function findParticipant(
  state: InternalRoomState,
  participantId: string,
): ParticipantState | undefined {
  if (participantId === '') {
    return undefined;
  }
  return state.participants.find((participant) => participant.id === participantId);
}

function isDisplayNameTaken(
  participants: readonly ParticipantState[],
  displayName: string,
  exceptParticipantId: string | undefined,
): boolean {
  return participants.some(
    (participant) => participant.name === displayName && participant.id !== exceptParticipantId,
  );
}
