/** Real sockets verify refusal delivery, handler suppression, recovery and stale-connection priority. */
import { afterEach, expect, it, vi } from 'vitest';
import type { RenameResponse } from '@quiz-world/shared';
import {
  startSocketTestHarness,
  nextRoomState,
  nextError,
  emitParticipantJoin,
  type SocketTestHarness,
  type AppClient,
} from '../testing/socketTestHarness';
let harness: SocketTestHarness | undefined;
afterEach(async () => {
  await harness?.stop();
});
const rename = (client: AppClient, name: string): Promise<RenameResponse> =>
  new Promise((resolve) => client.emit('participant:rename', { displayName: name }, resolve));
it('rejects ack operations without mutation or broadcast, then accepts them when the window resets', async () => {
  let now = 0;
  harness = await startSocketTestHarness({
    now: () => now,
    rateLimits: { 'participant:rename': { limit: 1, windowMs: 1000 } },
  });
  const room = await harness.seedRoom('limits');
  const all = () =>
    Promise.all([nextRoomState(room.host), nextRoomState(room.first), nextRoomState(room.second)]);
  let views = all();
  expect(await rename(room.first, '次郎')).toEqual({ ok: true, displayName: '次郎' });
  await views;
  const broadcasts = vi.fn();
  room.host.on('room:state', broadcasts);
  expect(await rename(room.first, '拒否される名前')).toEqual({
    ok: false,
    code: 'RATE_LIMITED',
    message: '操作が多すぎます。少し待ってから再試行してください',
  });
  expect(broadcasts).not.toHaveBeenCalled();
  // A different socket can still change its name, exposing the authoritative roster.
  views = all();
  expect(await rename(room.second, '三郎')).toMatchObject({ ok: true });
  expect((await views)[0]?.participants.find((p) => p.id === room.firstId)?.name).toBe('次郎');
  now = 1000;
  views = all();
  expect(await rename(room.first, '四郎')).toMatchObject({ ok: true });
  await views;
});
it('uses the error event for gameplay and lets another participant buzz independently', async () => {
  harness = await startSocketTestHarness({
    rateLimits: { 'game:buzz': { limit: 1, windowMs: 1000 } },
  });
  const room = await harness.seedRoom('buzz limits');
  const all = () =>
    Promise.all([nextRoomState(room.host), nextRoomState(room.first), nextRoomState(room.second)]);
  let views = all();
  room.first.emit('game:buzz', {});
  await views;
  const refused = nextError(room.first);
  room.first.emit('game:buzz', {});
  expect(await refused).toMatchObject({ code: 'RATE_LIMITED' });
  views = all();
  room.second.emit('game:buzz', {});
  expect((await views)[0]?.buzzOrder.map((e) => e.participantId)).toEqual([
    room.firstId,
    room.secondId,
  ]);
});
it('counts failed joins and keeps stale-connection rejection ahead of rate limiting', async () => {
  harness = await startSocketTestHarness({
    rateLimits: {
      'participant:rename': { limit: 1, windowMs: 1000 },
      'tournament:join': { limit: 1, windowMs: 1000 },
    },
  });
  const room = await harness.seedRoom('stale');
  const all = Promise.all([
    nextRoomState(room.host),
    nextRoomState(room.first),
    nextRoomState(room.second),
  ]);
  await rename(room.first, '次郎');
  await all;
  const replacement = await harness.openClient();
  await emitParticipantJoin(replacement, {
    tournamentId: room.tournamentId,
    displayName: '次郎',
    participantId: room.firstId,
  });
  expect(await rename(room.first, '名前')).toMatchObject({ ok: false, code: 'STALE_CONNECTION' });
  const newcomer = await harness.openClient();
  expect(
    await emitParticipantJoin(newcomer, { tournamentId: room.tournamentId, displayName: '' }),
  ).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  expect(
    await emitParticipantJoin(newcomer, { tournamentId: room.tournamentId, displayName: '新規' }),
  ).toMatchObject({ ok: false, code: 'RATE_LIMITED' });
});
