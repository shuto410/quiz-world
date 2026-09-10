/** Real sockets exercise normalized names, competing claims and the privacy boundary. */
import { afterEach, expect, it } from 'vitest';
import type { RenameResponse } from '@quiz-world/shared';
import {
  startSocketTestHarness,
  nextRoomState,
  emitParticipantJoin,
  type SocketTestHarness,
  type AppClient,
} from '../testing/socketTestHarness';
let harness: SocketTestHarness | undefined;
afterEach(async () => {
  await harness?.stop();
});
const rename = (client: AppClient, displayName: unknown): Promise<RenameResponse> =>
  new Promise((resolve) =>
    client.emit('participant:rename', { displayName } as { displayName: string }, resolve),
  );
it('renames only the sender, keeps a pending answer private and resolves competing names atomically', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('rename');
  const all = () =>
    Promise.all([nextRoomState(room.host), nextRoomState(room.first), nextRoomState(room.second)]);
  let views = all();
  room.first.emit('game:buzz', {});
  await views;
  views = all();
  room.first.emit('answer:submit', { answerText: 'secret' });
  await views;
  views = all();
  const ack: RenameResponse = await new Promise((resolve) =>
    room.first.emit(
      'participant:rename',
      { displayName: '  次郎  ', participantId: room.secondId } as { displayName: string },
      resolve,
    ),
  );
  expect(ack).toEqual({ ok: true, displayName: '次郎' });
  const states = await views;
  expect(states[0]?.currentSubmittedAnswer?.answerText).toBe('secret');
  expect(states[1]).not.toHaveProperty('currentSubmittedAnswer');
  expect(states[0]?.participants.find((p) => p.id === room.firstId)?.name).toBe('次郎');
  expect(states[0]?.participants.find((p) => p.id === room.secondId)?.name).toBe('花子');
  const results = await Promise.all([rename(room.first, '共通名'), rename(room.second, '共通名')]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.find((r) => !r.ok)).toMatchObject({ code: 'DUPLICATE_DISPLAY_NAME' });
});
it('validates input and refuses unjoined and superseded connections', async () => {
  harness = await startSocketTestHarness();
  const room = await harness.seedRoom('validation');
  const stranger = await harness.openClient();
  expect(await rename(stranger, '名前')).toMatchObject({ ok: false, code: 'INVALID_STATE' });
  for (const name of ['', ' '.repeat(5), 'a'.repeat(21), 'a\nb', 42])
    expect(await rename(room.first, name)).toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
  const replacement = await harness.openClient();
  await emitParticipantJoin(replacement, {
    tournamentId: room.tournamentId,
    displayName: '太郎',
    participantId: room.firstId,
  });
  expect(await rename(room.first, '名前')).toMatchObject({ ok: false, code: 'STALE_CONNECTION' });
});
