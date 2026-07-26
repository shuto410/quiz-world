/**
 * Tripwire tests for the shape of the room state.
 *
 * These do not test behaviour; there is none yet. They exist because the costly mistake in
 * this codebase is not a wrong branch but a slowly drifting model: someone adds
 * `participant.isHost` or `roomState.winnerId` for convenience, the client starts trusting
 * it, and the server is no longer the only place that decides who won.
 *
 * The mechanism is a fully populated sample typed as `Required<T>`. Adding or removing a
 * field forces the sample to change, and the sample is then compared against the frozen key
 * list, so a new field cannot land without someone editing that list on purpose. The design
 * rationale, and the list of values that must stay derived, is in
 * `docs/design.md` under "派生値を持たない方針".
 */

import { describe, expect, it } from 'vitest';
import type { BuzzEntry, InternalRoomState, LastResultState, ParticipantState } from './game';
import { PARTICIPANT_STATE_KEYS, ROOM_STATE_KEYS } from './game';

const participant: Required<ParticipantState> = {
  id: 'participant-1',
  name: 'Alice',
  online: true,
  joinedAt: 1_700_000_000_000,
  score: 3,
};

const buzzEntry: Required<BuzzEntry> = {
  participantId: 'participant-1',
  receivedAt: 1_700_000_000_200,
};

const lastResult: Required<LastResultState> = {
  participantId: 'participant-1',
  isCorrect: true,
  scoreDelta: 1,
};

/** Every optional field is populated, so the sample carries the maximal key set. */
const roomState: Required<InternalRoomState> = {
  tournamentId: 'tournament-1',
  status: 'result',
  statusBeforePause: 'answering',
  pausedReason: 'hostDisconnected',
  hostId: 'participant-1',
  hostOnline: true,
  participants: [participant],
  currentBuzzSession: { id: 'buzz-1', startedAt: 1_700_000_000_100 },
  buzzOrder: [buzzEntry],
  currentResponderId: 'participant-1',
  currentSubmittedAnswer: {
    participantId: 'participant-1',
    answerText: 'an answer',
    receivedAt: 1_700_000_000_300,
  },
  lastResult,
  updatedAt: 1_700_000_000_400,
};

describe('room state shape', () => {
  it('keeps InternalRoomState limited to the frozen key list', () => {
    expect(Object.keys(roomState).sort()).toEqual([...ROOM_STATE_KEYS].sort());
  });

  it('keeps ParticipantState limited to the frozen key list', () => {
    expect(Object.keys(participant).sort()).toEqual([...PARTICIPANT_STATE_KEYS].sort());
  });

  it('stores no rank on a buzz entry, since the rank is the index in buzzOrder', () => {
    expect(Object.keys(buzzEntry).sort()).toEqual(['participantId', 'receivedAt']);
  });

  it('stores no running total on a result, since the total lives on the participant', () => {
    expect(Object.keys(lastResult).sort()).toEqual(['isCorrect', 'participantId', 'scoreDelta']);
  });
});
