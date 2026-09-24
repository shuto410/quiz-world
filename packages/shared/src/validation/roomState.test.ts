/** Stored rooms are untrusted JSON; malformed nested fields must never become game state. */
import { describe, expect, it } from 'vitest';
import { parseRoomState } from './roomState';
const state = {
  rules: { type: 'points', correctPoints: 1, wrongPoints: 0 },
  tournamentId: 't',
  status: 'paused',
  statusBeforePause: 'answering',
  pausedReason: 'hostDisconnected',
  hostId: 'h',
  initialHostId: 'h',
  hostOnline: false,
  participants: [
    {
      correctCount: 0,
      wrongCount: 0,
      id: 'h',
      name: 'Host',
      online: false,
      joinedAt: 1,
      score: -2,
    },
  ],
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
        rules: { type: 'points', correctPoints: 1, wrongPoints: 0 },
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

it('migrates legacy snapshots without inferring counts from old scores', () => {
  const { rules, ...legacy } = state;
  const restored = parseRoomState({
    ...legacy,
    participants: [{ id: 'a', name: 'A', online: true, score: 5, joinedAt: 1 }],
  });
  expect(restored.rules).toEqual({ type: 'points', correctPoints: 1, wrongPoints: 0 });
  expect(restored.participants[0]).toMatchObject({ score: 5, correctCount: 0, wrongCount: 0 });
});
it.each([
  { rules: { type: 'maruBatsu', correctTarget: 0, wrongLimit: 3 } },
  { rules: null },
  { participants: [{ ...state.participants[0], correctCount: -1 }] },
  { participants: [{ ...state.participants[0], wrongCount: 1.5 }] },
  { participants: [{ ...state.participants[0], correctCount: '1' }] },
])('refuses corrupt persisted rules/counts %j', (fields) => {
  expect(() => parseRoomState({ ...state, ...fields })).toThrow('invalid room state');
});
it('restores n○m× rules and both counts exactly', () => {
  const snapshot = {
    ...state,
    rules: { type: 'maruBatsu', correctTarget: 7, wrongLimit: 3 },
    participants: [{ ...state.participants[0], correctCount: 7, wrongCount: 2 }],
  };
  expect(parseRoomState(snapshot)).toEqual(snapshot);
});
