/** Stored rooms are untrusted JSON; malformed nested fields must never become game state. */
import { describe, expect, it } from 'vitest';
import { parseRoomState } from './roomState';
const state = {
  tournamentId: 't',
  status: 'paused',
  statusBeforePause: 'answering',
  pausedReason: 'hostDisconnected',
  hostId: 'h',
  initialHostId: 'h',
  hostOnline: false,
  participants: [{ id: 'h', name: 'Host', online: false, joinedAt: 1, score: -2 }],
  buzzOrder: [{ participantId: 'h', receivedAt: 1 }],
  currentBuzzSession: { id: 'b', startedAt: 1 },
  currentResponderId: 'h',
  currentSubmittedAnswer: { participantId: 'h', answerText: 'secret', receivedAt: 2 },
  lastResult: { participantId: 'h', isCorrect: true, scoreDelta: 2 },
  updatedAt: 2,
};
describe('parseRoomState', () => {
  it('rebuilds known fields and drops unknown data', () =>
    expect(parseRoomState({ ...state, secretToken: 'hidden' })).toEqual(state));
  it.each([
    null,
    [],
    { ...state, status: 'draft' },
    { ...state, participants: [{ ...state.participants[0], score: '1' }] },
    { ...state, buzzOrder: [null] },
    { ...state, currentBuzzSession: { id: 'b' } },
    { ...state, currentSubmittedAnswer: { answerText: 'secret' } },
    { ...state, lastResult: { isCorrect: 'true' } },
    { ...state, statusBeforePause: 'other' },
    { ...state, pausedReason: 'other' },
    { ...state, updatedAt: Infinity },
  ])('rejects corrupt data without quoting its contents', (value) =>
    expect(() => parseRoomState(value)).toThrow('invalid room state'),
  );
  it('accepts a minimal empty room', () =>
    expect(
      parseRoomState({
        tournamentId: 't',
        status: 'idle',
        hostId: '',
        hostOnline: false,
        participants: [],
        buzzOrder: [],
        updatedAt: 1,
      }),
    ).toMatchObject({ status: 'idle' }));
});
