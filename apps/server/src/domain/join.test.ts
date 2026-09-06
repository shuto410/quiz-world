/**
 * Tests for join / leave transitions.
 *
 * These pin the rules that decide who may enter a room: capacity on first join only,
 * unique display names, reconnect by claimed id, and leave that keeps the seat. Failures
 * are codes alone — never a room state — which is what keeps a refused joiner from learning
 * who is already inside.
 */

import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import {
  DEFAULT_HOST_DISPLAY_NAME,
  applyHostJoin,
  applyLeave,
  applyParticipantJoin,
  createInitialRoomState,
} from './join';

const NOW = 1_700_000_000_100;
const LATER = 1_700_000_000_200;

describe('createInitialRoomState', () => {
  it('starts empty with no host seated yet', () => {
    expect(createInitialRoomState('tournament-1', NOW)).toEqual({
      tournamentId: 'tournament-1',
      status: 'idle',
      hostId: '',
      hostOnline: false,
      participants: [],
      buzzOrder: [],
      updatedAt: NOW,
    });
  });
});

describe('applyHostJoin', () => {
  it('creates the host seat on the first visit', () => {
    const current = createInitialRoomState('tournament-1', NOW);

    const result = applyHostJoin(current, { newParticipantId: 'host-1', now: LATER });

    expect(result).toEqual({
      ok: true,
      participantId: 'host-1',
      isReconnect: false,
      state: {
        ...current,
        hostId: 'host-1',
        hostOnline: true,
        participants: [
          {
            id: 'host-1',
            name: DEFAULT_HOST_DISPLAY_NAME,
            online: true,
            joinedAt: LATER,
            score: 0,
          },
        ],
        updatedAt: LATER,
      },
    });
  });

  it('resumes the existing host seat on reconnect', () => {
    const current = createRoomStateFixture({
      hostId: 'host-1',
      hostOnline: false,
      participants: [
        {
          id: 'host-1',
          name: DEFAULT_HOST_DISPLAY_NAME,
          online: false,
          joinedAt: NOW,
          score: 2,
        },
      ],
    });

    const result = applyHostJoin(current, { newParticipantId: 'ignored', now: LATER });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.participantId).toBe('host-1');
    expect(result.isReconnect).toBe(true);
    expect(result.state.hostOnline).toBe(true);
    expect(result.state.participants[0]).toMatchObject({
      id: 'host-1',
      online: true,
      score: 2,
    });
  });

  it('restores statusBeforePause when the host returns to a paused room', () => {
    const current = createRoomStateFixture({
      status: 'paused',
      statusBeforePause: 'answering',
      pausedReason: 'hostDisconnected',
      hostOnline: false,
      currentResponderId: 'participant-2',
      participants: [
        {
          id: 'participant-1',
          name: DEFAULT_HOST_DISPLAY_NAME,
          online: false,
          joinedAt: NOW,
          score: 0,
        },
        {
          id: 'participant-2',
          name: '太郎',
          online: true,
          joinedAt: NOW,
          score: 1,
        },
      ],
    });

    const result = applyHostJoin(current, { newParticipantId: 'ignored', now: LATER });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.status).toBe('answering');
    expect(result.state).not.toHaveProperty('statusBeforePause');
    expect(result.state).not.toHaveProperty('pausedReason');
    expect(result.state.currentResponderId).toBe('participant-2');
  });

  it('rejects when a guest already took the default host display name', () => {
    const current = createInitialRoomState('tournament-1', NOW);
    const occupied = {
      ...current,
      participants: [
        {
          id: 'guest-1',
          name: DEFAULT_HOST_DISPLAY_NAME,
          online: true,
          joinedAt: NOW,
          score: 0,
        },
      ],
    };

    expect(applyHostJoin(occupied, { newParticipantId: 'host-1', now: LATER })).toEqual({
      ok: false,
      code: 'DUPLICATE_DISPLAY_NAME',
    });
  });
});

describe('applyParticipantJoin', () => {
  const baseInput = {
    displayName: '花子',
    claimedParticipantId: undefined,
    newParticipantId: 'participant-2',
    now: LATER,
    maxParticipants: 3,
    tournamentStatus: 'active' as const,
  };

  it('adds a newcomer with score 0', () => {
    const current = createRoomStateFixture();

    const result = applyParticipantJoin(current, baseInput);

    expect(result).toEqual({
      ok: true,
      participantId: 'participant-2',
      isReconnect: false,
      state: {
        ...current,
        participants: [
          ...current.participants,
          {
            id: 'participant-2',
            name: '花子',
            online: true,
            joinedAt: LATER,
            score: 0,
          },
        ],
        updatedAt: LATER,
      },
    });
  });

  it('rejects a closed tournament', () => {
    const current = createRoomStateFixture();

    expect(applyParticipantJoin(current, { ...baseInput, tournamentStatus: 'closed' })).toEqual({
      ok: false,
      code: 'TOURNAMENT_NOT_JOINABLE',
    });
  });

  it('rejects a newcomer once the tournament has finished', () => {
    // The stored status may still say active: it is written after the room finishes, so this
    // check is what holds if that write failed.
    const current = createRoomStateFixture({ status: 'finished' });

    expect(applyParticipantJoin(current, baseInput)).toEqual({
      ok: false,
      code: 'TOURNAMENT_NOT_JOINABLE',
    });
  });

  it('still lets somebody who played reconnect to a finished tournament', () => {
    const current = createRoomStateFixture({
      status: 'finished',
      participants: [
        {
          id: 'participant-1',
          name: DEFAULT_HOST_DISPLAY_NAME,
          online: true,
          joinedAt: NOW,
          score: 0,
        },
        { id: 'participant-2', name: '花子', online: false, joinedAt: NOW, score: 4 },
      ],
    });

    const result = applyParticipantJoin(current, {
      ...baseInput,
      claimedParticipantId: 'participant-2',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.isReconnect).toBe(true);
    expect(result.state.participants[1]).toMatchObject({ score: 4, online: true });
  });

  it('rejects a newcomer when the room is at capacity', () => {
    const current = createRoomStateFixture({
      participants: [
        {
          id: 'participant-1',
          name: DEFAULT_HOST_DISPLAY_NAME,
          online: true,
          joinedAt: NOW,
          score: 0,
        },
        {
          id: 'participant-2',
          name: '太郎',
          online: true,
          joinedAt: NOW,
          score: 0,
        },
      ],
    });

    expect(applyParticipantJoin(current, { ...baseInput, maxParticipants: 2 })).toEqual({
      ok: false,
      code: 'TOURNAMENT_FULL',
    });
  });

  it('rejects a display name another seat already uses', () => {
    const current = createRoomStateFixture();

    expect(
      applyParticipantJoin(current, { ...baseInput, displayName: DEFAULT_HOST_DISPLAY_NAME }),
    ).toEqual({ ok: false, code: 'DUPLICATE_DISPLAY_NAME' });
  });

  it('resumes an existing seat without re-checking capacity', () => {
    const current = createRoomStateFixture({
      participants: [
        {
          id: 'participant-1',
          name: DEFAULT_HOST_DISPLAY_NAME,
          online: true,
          joinedAt: NOW,
          score: 0,
        },
        {
          id: 'participant-2',
          name: '旧名',
          online: false,
          joinedAt: NOW,
          score: 4,
        },
      ],
    });

    const result = applyParticipantJoin(current, {
      ...baseInput,
      displayName: '新名',
      claimedParticipantId: 'participant-2',
      maxParticipants: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.isReconnect).toBe(true);
    expect(result.participantId).toBe('participant-2');
    expect(result.state.participants).toEqual([
      current.participants[0],
      {
        id: 'participant-2',
        name: '新名',
        online: true,
        joinedAt: NOW,
        score: 4,
      },
    ]);
  });

  it('ignores an unknown claimed id and issues a fresh seat', () => {
    const current = createRoomStateFixture();

    const result = applyParticipantJoin(current, {
      ...baseInput,
      claimedParticipantId: 'no-such-id',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.isReconnect).toBe(false);
    expect(result.participantId).toBe('participant-2');
  });

  it('rejects a reconnect that would collide with another seat name', () => {
    const current = createRoomStateFixture({
      participants: [
        {
          id: 'participant-1',
          name: DEFAULT_HOST_DISPLAY_NAME,
          online: true,
          joinedAt: NOW,
          score: 0,
        },
        {
          id: 'participant-2',
          name: '太郎',
          online: false,
          joinedAt: NOW,
          score: 0,
        },
        {
          id: 'participant-3',
          name: '花子',
          online: true,
          joinedAt: NOW,
          score: 0,
        },
      ],
    });

    expect(
      applyParticipantJoin(current, {
        ...baseInput,
        displayName: '花子',
        claimedParticipantId: 'participant-2',
      }),
    ).toEqual({ ok: false, code: 'DUPLICATE_DISPLAY_NAME' });
  });
});

describe('applyLeave', () => {
  it('marks the seat offline and keeps score and name', () => {
    const current = createRoomStateFixture({
      participants: [
        {
          id: 'participant-1',
          name: DEFAULT_HOST_DISPLAY_NAME,
          online: true,
          joinedAt: NOW,
          score: 0,
        },
        {
          id: 'participant-2',
          name: '太郎',
          online: true,
          joinedAt: NOW,
          score: 5,
        },
      ],
    });

    const result = applyLeave(current, 'participant-2', LATER);

    expect(result).toEqual({
      ok: true,
      state: {
        ...current,
        participants: [
          current.participants[0],
          {
            id: 'participant-2',
            name: '太郎',
            online: false,
            joinedAt: NOW,
            score: 5,
          },
        ],
        updatedAt: LATER,
      },
    });
  });

  it('clears hostOnline when the current host leaves', () => {
    const current = createRoomStateFixture({ hostOnline: true });

    const result = applyLeave(current, 'participant-1', LATER);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.hostOnline).toBe(false);
    expect(result.state.participants[0]?.online).toBe(false);
  });

  it('accepts a leave for an unknown id as a no-op', () => {
    const current = createRoomStateFixture();

    expect(applyLeave(current, 'missing', LATER)).toEqual({ ok: true, state: current });
  });
});
