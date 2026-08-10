/**
 * Tests for the single state distribution path.
 *
 * The point of routing every broadcast through one function is that the host and the
 * participants get different payloads without any call site having to remember. So what is
 * checked here is the routing: which channel received which view, and that both were served
 * from the same read of the state.
 */

import type { SubmittedAnswerState } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomRegistry } from '../rooms/roomRegistry';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import type { SocketServer } from './broadcast';
import { broadcastRoomState, hostChannel, participantChannel } from './broadcast';

type Emission = { channel: string; event: string; payload: unknown };

/**
 * Stands in for the Socket.io server. Only `to().emit()` is exercised, and recording it is
 * the whole assertion, so a fake is more direct than a real server plus connected clients.
 */
function createRecordingServer(): { io: SocketServer; emissions: Emission[] } {
  const emissions: Emission[] = [];

  const io = {
    to: (channel: string) => ({
      emit: (event: string, payload: unknown) => {
        emissions.push({ channel, event, payload });
      },
    }),
  };

  return { io: io as unknown as SocketServer, emissions };
}

const submittedAnswer: SubmittedAnswerState = {
  participantId: 'participant-2',
  answerText: '判定前の回答',
  receivedAt: 1_700_000_000_500,
};

describe('broadcastRoomState', () => {
  it('sends the full state to the host and the stripped state to participants', () => {
    const registry = createRoomRegistry({ now: () => 1 });
    const state = createRoomStateFixture({
      status: 'answering',
      currentResponderId: 'participant-2',
      currentSubmittedAnswer: submittedAnswer,
    });
    const handle = registry.claim('tournament-1', state);
    const { io, emissions } = createRecordingServer();

    broadcastRoomState(io, handle);

    const participantView = { ...state };
    delete participantView.currentSubmittedAnswer;

    expect(emissions).toEqual([
      { channel: hostChannel('tournament-1'), event: 'room:state', payload: state },
      {
        channel: participantChannel('tournament-1'),
        event: 'room:state',
        payload: participantView,
      },
    ]);
  });

  it('sends the answer to both audiences once the judgement is on screen', () => {
    const registry = createRoomRegistry({ now: () => 1 });
    const state = createRoomStateFixture({
      status: 'result',
      currentSubmittedAnswer: submittedAnswer,
      lastResult: { participantId: 'participant-2', isCorrect: false, scoreDelta: -1 },
    });
    const handle = registry.claim('tournament-1', state);
    const { io, emissions } = createRecordingServer();

    broadcastRoomState(io, handle);

    expect(emissions.map((emission) => emission.payload)).toEqual([state, state]);
  });

  it('addresses channels scoped to the tournament, so rooms cannot bleed into each other', () => {
    expect(hostChannel('tournament-1')).not.toBe(hostChannel('tournament-2'));
    expect(hostChannel('tournament-1')).not.toBe(participantChannel('tournament-1'));
  });
});
