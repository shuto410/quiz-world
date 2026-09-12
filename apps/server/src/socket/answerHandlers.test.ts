/**
 * Integration tests for `answer:submit` over a real Socket.io server.
 *
 * The invariant worth an end-to-end test is the audience split: the same submission must
 * reach the host with its text and every participant without it. Asserting that on the wire
 * is the only way to catch a handler that emits state on its own instead of going through
 * `broadcastRoomState()`, which is where the conversion happens.
 *
 * The rest pins the refusals a client can provoke — no answer right, wrong status, empty
 * text — and that the sender is resolved from the session even when the payload claims
 * somebody else.
 */

import type { AnswerSubmitPayload, RoomStateEvent } from '@quiz-world/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { TEST_NOW } from '../testing/appDependencies';
import {
  nextError,
  nextRoomState,
  startSocketTestHarness,
  type SocketTestHarness,
} from '../testing/socketTestHarness';

let harness: SocketTestHarness | undefined;

async function start(): Promise<SocketTestHarness> {
  harness = await startSocketTestHarness();
  return harness;
}

afterEach(async () => {
  await harness?.stop();
  harness = undefined;
});

/** Opens a round by letting the first participant buzz, and waits for everyone to see it. */
async function openRound(room: Awaited<ReturnType<SocketTestHarness['seedRoom']>>): Promise<void> {
  const seen = [nextRoomState(room.host), nextRoomState(room.first), nextRoomState(room.second)];
  room.first.emit('game:buzz', {});
  await Promise.all(seen);
}

describe('answer handlers', () => {
  it('shows the answer to the host and withholds it from every participant', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('テキスト回答大会');
    await openRound(room);

    const hostView = nextRoomState(room.host);
    const responderView = nextRoomState(room.first);
    const bystanderView = nextRoomState(room.second);
    room.first.emit('answer:submit', { answerText: '  東京  ' });
    const [forHost, forResponder, forBystander] = await Promise.all([
      hostView,
      responderView,
      bystanderView,
    ]);

    expect(forHost.currentSubmittedAnswer).toEqual({
      participantId: room.firstId,
      // Stored trimmed: the shared validator normalises before the state ever sees it.
      answerText: '東京',
      receivedAt: TEST_NOW,
    });
    // Not merely empty — the field must be absent for participants, including the sender.
    expect(forResponder).not.toHaveProperty('currentSubmittedAnswer');
    expect(forBystander).not.toHaveProperty('currentSubmittedAnswer');
  });

  it('refuses a non-responder even when the payload claims the answer holder', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('回答権なし大会');
    await openRound(room);

    const errorPromise = nextError(room.second);
    const hostView = nextRoomState(room.host);
    room.second.emit('answer:submit', {
      answerText: '横取り',
      participantId: room.firstId,
    } as AnswerSubmitPayload);
    const [error, forHost] = await Promise.all([errorPromise, hostView]);

    expect(error).toEqual({
      code: 'NOT_CURRENT_RESPONDER',
      message: '回答権のある参加者だけが回答できます',
    });
    expect(forHost.currentSubmittedAnswer).toBeUndefined();
  });

  it('refuses the host seat, which can never hold the answer right', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('ホスト回答大会');
    await openRound(room);

    const errorPromise = nextError(room.host);
    room.host.emit('answer:submit', { answerText: '東京' });

    await expect(errorPromise).resolves.toMatchObject({ code: 'NOT_CURRENT_RESPONDER' });
  });

  it('refuses an answer while no round is open', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('待機中回答大会');

    const errorPromise = nextError(room.first);
    room.first.emit('answer:submit', { answerText: '東京' });

    await expect(errorPromise).resolves.toEqual({
      code: 'INVALID_STATE',
      message: '現在の状態ではその操作はできません',
    });
  });

  it('rejects blank text with the shared validator copy and without a rebroadcast', async () => {
    const { seedRoom } = await start();
    const room = await seedRoom('空回答大会');
    await openRound(room);

    const received: RoomStateEvent[] = [];
    room.host.on('room:state', (state) => {
      received.push(state);
    });

    const errorPromise = nextError(room.first);
    room.first.emit('answer:submit', { answerText: '   ' });
    await expect(errorPromise).resolves.toEqual({
      code: 'VALIDATION_ERROR',
      message: '回答を入力してください',
    });

    // A valid submission behind it proves ordering: had the blank one broadcast, its state
    // would already be in `received` by the time this one arrives.
    const accepted = nextRoomState(room.first);
    room.first.emit('answer:submit', { answerText: '東京' });
    await accepted;

    expect(received).toHaveLength(1);
    expect(received[0]?.currentSubmittedAnswer?.answerText).toBe('東京');
  });

  it('rejects an answer from a connection that never joined', async () => {
    const { openClient } = await start();
    const stranger = await openClient();

    const errorPromise = nextError(stranger);
    stranger.emit('answer:submit', { answerText: '東京' });

    await expect(errorPromise).resolves.toMatchObject({ code: 'INVALID_STATE' });
  });
});
