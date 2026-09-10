/** Verifies pause preservation and atomic host takeover without changing scores or leaking answer rights. */
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyLeave, applyHostJoin, applyParticipantJoin } from './join';
import { applyHostClaim } from './host';

const participants = [
  { id: 'h', name: 'ホスト', online: true, score: 0, joinedAt: 1 },
  { id: 'a', name: '太郎', online: true, score: 5, joinedAt: 1 },
  { id: 'b', name: '花子', online: true, score: 2, joinedAt: 1 },
];
function paused() {
  return createRoomStateFixture({
    hostId: 'h',
    initialHostId: 'h',
    hostOnline: false,
    participants: participants.map((p) => (p.id === 'h' ? { ...p, online: false } : p)),
    status: 'paused',
    statusBeforePause: 'answering',
    pausedReason: 'hostDisconnected',
    currentResponderId: 'a',
    currentBuzzSession: { id: 'round', startedAt: 1 },
    buzzOrder: [
      { participantId: 'a', receivedAt: 1 },
      { participantId: 'b', receivedAt: 2 },
    ],
    currentSubmittedAnswer: { participantId: 'a', answerText: '東京', receivedAt: 3 },
  });
}

describe('host disconnect and takeover', () => {
  it.each(['idle', 'answering', 'result'] as const)(
    'pauses %s and preserves the round on repeated disconnect',
    (status) => {
      const current = { ...paused(), status, participants, hostOnline: true };
      const first = applyLeave(current, 'h', 10);
      expect(first).toMatchObject({
        ok: true,
        state: {
          status: 'paused',
          statusBeforePause: status,
          hostOnline: false,
          pausedReason: 'hostDisconnected',
          currentSubmittedAnswer: current.currentSubmittedAnswer,
        },
      });
      if (!first.ok) throw new Error('leave rejected');
      expect(applyLeave(first.state, 'h', 11)).toMatchObject({
        ok: true,
        state: { statusBeforePause: status },
      });
    },
  );
  it('keeps finished results and participant disconnects out of pause', () => {
    expect(applyLeave({ ...paused(), status: 'finished' }, 'h', 2)).toMatchObject({
      state: { status: 'finished' },
    });
    expect(applyLeave({ ...paused(), status: 'idle' }, 'a', 2)).toMatchObject({
      state: { status: 'idle' },
    });
  });
  it('lets only the first online claimant win and keeps the current answer for the new host', () => {
    const current = paused();
    const result = applyHostClaim(current, 'b', 10);
    expect(result).toMatchObject({
      ok: true,
      state: {
        hostId: 'b',
        initialHostId: 'h',
        hostOnline: true,
        status: 'answering',
        participants: current.participants,
        currentResponderId: 'a',
        currentSubmittedAnswer: current.currentSubmittedAnswer,
        buzzOrder: [{ participantId: 'a', receivedAt: 1 }],
      },
    });
    if (!result.ok) throw new Error('claim rejected');
    expect(result.state).not.toHaveProperty('statusBeforePause');
    expect(result.state).not.toHaveProperty('pausedReason');
    expect(applyHostClaim(result.state, 'a', 11)).toEqual({ ok: false, code: 'INVALID_STATE' });
    expect(applyHostJoin(result.state, { newParticipantId: 'ignored', now: 12 })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED',
    });
  });
  it('moves the answer right forward when the responder becomes host, or resets an empty round', () => {
    expect(applyHostClaim(paused(), 'a', 10)).toMatchObject({
      state: { hostId: 'a', currentResponderId: 'b', status: 'answering' },
    });
    const result = applyHostClaim(
      { ...paused(), buzzOrder: [{ participantId: 'a', receivedAt: 1 }] },
      'a',
      10,
    );
    expect(result).toMatchObject({ state: { status: 'idle', buzzOrder: [] } });
    if (!result.ok) throw new Error('claim rejected');
    expect(result.state).not.toHaveProperty('currentSubmittedAnswer');
    expect(result.state).not.toHaveProperty('currentResponderId');
  });
  it('rejects missing or offline seats, the old host, and malformed pause states', () => {
    for (const id of ['missing', 'h'])
      expect(applyHostClaim(paused(), id, 10)).toEqual({ ok: false, code: 'INVALID_STATE' });
    expect(
      applyHostClaim(
        { ...paused(), participants: participants.map((p) => ({ ...p, online: false })) },
        'a',
        10,
      ),
    ).toEqual({ ok: false, code: 'INVALID_STATE' });
    for (const state of [
      { ...paused(), pausedReason: undefined },
      { ...paused(), statusBeforePause: undefined },
      { ...paused(), statusBeforePause: 'paused' as const },
      { ...paused(), statusBeforePause: 'finished' as const },
      { ...paused(), hostOnline: true },
    ])
      expect(applyHostClaim(state, 'b', 10)).toEqual({ ok: false, code: 'INVALID_STATE' });
  });
  it('restores the new host by participant join while the original host returns as a participant', () => {
    const result = applyHostClaim(paused(), 'b', 10);
    if (!result.ok) throw new Error('claim rejected');
    const left = applyLeave(result.state, 'b', 11);
    if (!left.ok) throw new Error('leave rejected');
    const input = {
      displayName: '花子',
      claimedParticipantId: 'b',
      newParticipantId: 'unused',
      now: 12,
      maxParticipants: 3,
      tournamentStatus: 'active' as const,
    };
    expect(applyParticipantJoin(left.state, input)).toMatchObject({
      state: { hostId: 'b', hostOnline: true, status: 'answering' },
    });
    expect(
      applyParticipantJoin(left.state, {
        ...input,
        displayName: 'ホスト',
        claimedParticipantId: 'h',
      }),
    ).toMatchObject({ state: { hostId: 'b', hostOnline: false, status: 'paused' } });
  });
});
