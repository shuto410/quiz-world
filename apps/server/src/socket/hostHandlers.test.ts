/** Verifies takeover races, role-specific answer delivery, and reconnect authorization on real sockets. */
import { afterEach, expect, it } from 'vitest';
import type { HostClaimResponse } from '@quiz-world/shared';
import {
  startSocketTestHarness,
  nextRoomState,
  emitHostJoin,
  emitParticipantJoin,
  nextError,
  type SocketTestHarness,
  type AppClient,
} from '../testing/socketTestHarness';
let harness: SocketTestHarness | undefined;
afterEach(async () => {
  await harness?.stop();
});
const claim = (client: AppClient): Promise<HostClaimResponse> =>
  new Promise((resolve) => client.emit('host:claim', {}, resolve));

it('resumes the round, delivers the secret only to the winner, and demotes the original host on return', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('引き継ぎ');
  const allViews = () =>
    Promise.all([nextRoomState(room.host), nextRoomState(room.first), nextRoomState(room.second)]);
  let updated = allViews();
  room.first.emit('game:buzz', {});
  await updated;
  updated = allViews();
  room.first.emit('answer:submit', { answerText: '秘密の回答' });
  await updated;
  const paused = nextRoomState(room.second);
  room.host.disconnect();
  expect(await paused).toMatchObject({
    status: 'paused',
    statusBeforePause: 'answering',
    hostOnline: false,
  });
  const newHostState = nextRoomState(room.second);
  expect(await claim(room.second)).toEqual({ ok: true, hostId: room.secondId });
  expect(await newHostState).toMatchObject({
    status: 'answering',
    hostId: room.secondId,
    currentSubmittedAnswer: { answerText: '秘密の回答' },
  });
  const returned = await harness.openClient();
  expect(
    await emitHostJoin(returned, { tournamentId: room.tournamentId, hostToken: room.hostToken }),
  ).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
  // The old host's public seat remains in the roster and is the one the browser saved.
  const snapshot = nextRoomState(room.second);
  const error = nextError(room.first);
  room.first.emit('tournament:finish', {});
  await error;
  const hostId = (await snapshot).initialHostId;
  const returnedForHost = nextRoomState(room.second);
  const returnedState = nextRoomState(returned);
  expect(
    await emitParticipantJoin(returned, {
      tournamentId: room.tournamentId,
      displayName: 'ホスト',
      participantId: hostId,
    }),
  ).toMatchObject({ ok: true, role: 'participant' });
  expect(await returnedState).not.toHaveProperty('currentSubmittedAnswer');
  await returnedForHost;
  const refusedForHost = nextRoomState(room.second);
  const refused = nextError(returned);
  returned.emit('game:reset', {});
  expect(await refused).toMatchObject({ code: 'NOT_HOST' });
  await refusedForHost;
  const judged = nextRoomState(room.second);
  room.second.emit('judge:submit', {
    participantId: room.firstId,
    isCorrect: true,
    scoreDelta: 1,
    nextAction: 'showResult',
  });
  expect((await judged).participants.find((p) => p.id === room.firstId)?.score).toBe(1);
});

it('accepts one claimant, reconnects the winner as host, and rejects strangers and stale sockets', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('競合');
  const stranger = await harness.openClient();
  expect(await claim(stranger)).toMatchObject({ ok: false, code: 'INVALID_STATE' });
  const paused = nextRoomState(room.first);
  room.host.disconnect();
  await paused;
  const results = await Promise.all([claim(room.first), claim(room.second)]);
  expect(results.filter((result) => result.ok)).toHaveLength(1);
  expect(results.filter((result) => !result.ok)).toEqual([
    expect.objectContaining({ code: 'INVALID_STATE' }),
  ]);
  const winner = results[0]?.ok ? room.first : room.second;
  const winnerId = results[0]?.ok ? room.firstId : room.secondId;
  const name = results[0]?.ok ? '太郎' : '花子';
  const replacement = await harness.openClient();
  const restored = nextRoomState(replacement);
  expect(
    await emitParticipantJoin(replacement, {
      tournamentId: room.tournamentId,
      displayName: name,
      participantId: winnerId,
    }),
  ).toMatchObject({ ok: true, role: 'host' });
  expect(await restored).toMatchObject({ hostId: winnerId, status: 'idle' });
  expect(await claim(winner)).toMatchObject({ ok: false, code: 'STALE_CONNECTION' });
});
