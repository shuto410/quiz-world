/**
 * Tests for buzz transitions.
 *
 * The first block is the status-by-actor table required by the design: every game status is
 * enumerated from `GAME_STATUSES`, so a new status cannot be added without deciding here
 * whether the buzzer works in it. The blocks after it pin the behaviour of an accepted
 * buzz — who gets the answer right, what the recorded order is, and that the previous state
 * is left untouched.
 *
 * Ordering is asserted by applying buzzes one after another, in the order a single-threaded
 * server would receive them. Nothing here is asynchronous, which is the point: if this file
 * ever needs an `await`, the atomicity of the real handler has already been lost.
 */

import type { GameStatus, InternalRoomState, ParticipantState } from '@quiz-world/shared';
import { GAME_STATUSES } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyBuzz } from './buzz';

const HOST_ID = 'participant-1';
/** Already in `buzzOrder` while the room is `answering`. */
const RESPONDER_ID = 'participant-2';
/** Has not buzzed in any of the fixtures. */
const LATECOMER_ID = 'participant-3';

const JOINED_AT = 1_700_000_000_000;
const EARLIER = 1_700_000_000_500;
const NOW = 1_700_000_001_000;
const LATER = 1_700_000_001_400;

const NEW_SESSION_ID = 'buzz-session-2';

const PARTICIPANTS: ParticipantState[] = [
  { id: HOST_ID, name: 'ホスト', online: true, joinedAt: JOINED_AT, score: 0 },
  { id: RESPONDER_ID, name: '太郎', online: true, joinedAt: JOINED_AT, score: 3 },
  { id: LATECOMER_ID, name: '花子', online: true, joinedAt: JOINED_AT, score: 1 },
];

/**
 * A plausible room in the requested status.
 *
 * `answering` is built with participant-2 already holding the answer right, so the table can
 * ask both "may somebody else queue up" and "may the same person press again" against the
 * same fixture.
 */
function roomInStatus(status: GameStatus): InternalRoomState {
  switch (status) {
    case 'idle':
      return createRoomStateFixture({ participants: PARTICIPANTS });
    case 'answering':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'answering',
        currentBuzzSession: { id: 'buzz-session-1', startedAt: EARLIER },
        buzzOrder: [{ participantId: RESPONDER_ID, receivedAt: EARLIER }],
        currentResponderId: RESPONDER_ID,
      });
    case 'result':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'result',
        lastResult: { participantId: RESPONDER_ID, isCorrect: true, scoreDelta: 1 },
      });
    case 'paused':
      return createRoomStateFixture({
        participants: PARTICIPANTS,
        status: 'paused',
        statusBeforePause: 'idle',
        pausedReason: 'hostDisconnected',
        hostOnline: false,
      });
    case 'finished':
      return createRoomStateFixture({ participants: PARTICIPANTS, status: 'finished' });
  }
}

const ACTORS = ['responder', 'latecomer', 'host', 'stranger'] as const;

type Actor = (typeof ACTORS)[number];

const ACTOR_IDS: Record<Actor, string> = {
  responder: RESPONDER_ID,
  latecomer: LATECOMER_ID,
  host: HOST_ID,
  stranger: 'no-such-participant',
};

/**
 * Whether a buzz is accepted, for every status and every kind of sender.
 *
 * `Record<GameStatus, ...>` is what makes this exhaustive: adding a status to the domain
 * stops this file from compiling until the new row is filled in.
 */
const ACCEPTS_BUZZ: Record<GameStatus, Record<Actor, boolean>> = {
  // Nobody has buzzed yet, so any seated participant may open the round.
  idle: { responder: true, latecomer: true, host: false, stranger: false },
  // participant-2 already holds the answer right and is already in buzzOrder.
  answering: { responder: false, latecomer: true, host: false, stranger: false },
  result: { responder: false, latecomer: false, host: false, stranger: false },
  paused: { responder: false, latecomer: false, host: false, stranger: false },
  finished: { responder: false, latecomer: false, host: false, stranger: false },
};

describe('applyBuzz: status by actor', () => {
  for (const status of GAME_STATUSES) {
    for (const actor of ACTORS) {
      const accepted = ACCEPTS_BUZZ[status][actor];

      it(`${accepted ? 'accepts' : 'rejects'} a buzz from the ${actor} while ${status}`, () => {
        const current = roomInStatus(status);

        const result = applyBuzz(current, {
          participantId: ACTOR_IDS[actor],
          newBuzzSessionId: NEW_SESSION_ID,
          now: NOW,
        });

        expect(result.ok).toBe(accepted);
        if (!result.ok) {
          expect(result.code).toBe('INVALID_STATE');
        }
      });
    }
  }
});

describe('applyBuzz while idle', () => {
  it('opens a buzz session and hands the answer right to the presser', () => {
    const current = roomInStatus('idle');

    const result = applyBuzz(current, {
      participantId: LATECOMER_ID,
      newBuzzSessionId: NEW_SESSION_ID,
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      state: {
        ...current,
        status: 'answering',
        currentBuzzSession: { id: NEW_SESSION_ID, startedAt: NOW },
        buzzOrder: [{ participantId: LATECOMER_ID, receivedAt: NOW }],
        currentResponderId: LATECOMER_ID,
        updatedAt: NOW,
      },
    });
  });

  it('leaves scores and participants alone', () => {
    const current = roomInStatus('idle');

    const result = applyBuzz(current, {
      participantId: RESPONDER_ID,
      newBuzzSessionId: NEW_SESSION_ID,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.participants).toEqual(PARTICIPANTS);
  });
});

describe('applyBuzz while answering', () => {
  it('queues the presser behind the current responder without moving the answer right', () => {
    const current = roomInStatus('answering');

    const result = applyBuzz(current, {
      participantId: LATECOMER_ID,
      newBuzzSessionId: NEW_SESSION_ID,
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      state: {
        ...current,
        buzzOrder: [
          { participantId: RESPONDER_ID, receivedAt: EARLIER },
          { participantId: LATECOMER_ID, receivedAt: NOW },
        ],
        updatedAt: NOW,
      },
    });
  });

  it('keeps the round open under the id it started with', () => {
    const current = roomInStatus('answering');

    const result = applyBuzz(current, {
      participantId: LATECOMER_ID,
      newBuzzSessionId: NEW_SESSION_ID,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.currentBuzzSession).toEqual({ id: 'buzz-session-1', startedAt: EARLIER });
  });

  it('rejects a second press from someone already in the order', () => {
    const current = roomInStatus('answering');

    const first = applyBuzz(current, {
      participantId: LATECOMER_ID,
      newBuzzSessionId: NEW_SESSION_ID,
      now: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    expect(
      applyBuzz(first.state, {
        participantId: LATECOMER_ID,
        newBuzzSessionId: NEW_SESSION_ID,
        now: LATER,
      }),
    ).toEqual({ ok: false, code: 'INVALID_STATE' });
  });
});

describe('applyBuzz ordering', () => {
  it('records buzzes in the order the server received them', () => {
    const opened = applyBuzz(roomInStatus('idle'), {
      participantId: LATECOMER_ID,
      newBuzzSessionId: NEW_SESSION_ID,
      now: EARLIER,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) {
      return;
    }

    const queued = applyBuzz(opened.state, {
      participantId: RESPONDER_ID,
      newBuzzSessionId: 'ignored-session-id',
      now: NOW,
    });
    expect(queued.ok).toBe(true);
    if (!queued.ok) {
      return;
    }

    expect(queued.state.buzzOrder).toEqual([
      { participantId: LATECOMER_ID, receivedAt: EARLIER },
      { participantId: RESPONDER_ID, receivedAt: NOW },
    ]);
    expect(queued.state.currentResponderId).toBe(LATECOMER_ID);
  });

  it('does not modify the state it was given', () => {
    const current = roomInStatus('answering');
    const before = structuredClone(current);

    applyBuzz(current, {
      participantId: LATECOMER_ID,
      newBuzzSessionId: NEW_SESSION_ID,
      now: NOW,
    });

    expect(current).toEqual(before);
  });
});
