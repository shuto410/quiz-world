/** Recovery preserves gameplay while discarding transport liveness from the old process. */
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { restoreRoomState } from './restore';

describe('restoreRoomState', () => {
  it.each(['idle', 'answering', 'result'] as const)(
    'pauses %s without losing round data',
    (status) => {
      const state = createRoomStateFixture({
        status,
        currentResponderId: 'p',
        currentSubmittedAnswer: { participantId: 'p', answerText: 'secret', receivedAt: 1 },
      });
      const restored = restoreRoomState(state, 20);
      expect(restored).toEqual({
        ...state,
        status: 'paused',
        statusBeforePause: status,
        pausedReason: 'hostDisconnected',
        hostOnline: false,
        participants: state.participants.map((p) => ({ ...p, online: false })),
        updatedAt: 20,
      });
      expect(state.hostOnline).toBe(true);
    },
  );
  it('keeps the original phase of a paused room and preserves finished results', () => {
    const paused = createRoomStateFixture({
      status: 'paused',
      statusBeforePause: 'answering',
      pausedReason: 'hostDisconnected',
    });
    expect(restoreRoomState(paused, 20)).toMatchObject({
      status: 'paused',
      statusBeforePause: 'answering',
    });
    expect(restoreRoomState(createRoomStateFixture({ status: 'finished' }), 20)).toMatchObject({
      status: 'finished',
      hostOnline: false,
    });
  });
  it('leaves a room that has never had a host ready for its first host', () => {
    expect(
      restoreRoomState(createRoomStateFixture({ hostId: '', participants: [] }), 20).status,
    ).toBe('idle');
  });
});
