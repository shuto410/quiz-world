/**
 * Tests for the participant view of the room state.
 *
 * This is one of the invariants named in `docs/design.md`: an answer that has not been
 * judged must never reach a participant. The failure mode is quiet and total, since every
 * participant would see the answer on their own screen while the host is still deciding, so
 * it is checked against every status rather than the one that happens to be convenient.
 */

import type { SubmittedAnswerState } from '@quiz-world/shared';
import { GAME_STATUSES } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { toParticipantRoomState } from './roomState';

const submittedAnswer: SubmittedAnswerState = {
  participantId: 'participant-2',
  answerText: '正解かもしれない回答',
  receivedAt: 1_700_000_000_500,
};

const statusesHidingTheAnswer = GAME_STATUSES.filter((status) => status !== 'result');

describe('toParticipantRoomState', () => {
  it.each(statusesHidingTheAnswer)('removes the unjudged answer while %s', (status) => {
    const state = createRoomStateFixture({ status, currentSubmittedAnswer: submittedAnswer });

    expect(toParticipantRoomState(state)).not.toHaveProperty('currentSubmittedAnswer');
  });

  it('reveals the answer once the judgement is on screen', () => {
    const state = createRoomStateFixture({
      status: 'result',
      currentSubmittedAnswer: submittedAnswer,
      lastResult: { participantId: 'participant-2', isCorrect: true, scoreDelta: 1 },
    });

    expect(toParticipantRoomState(state)).toEqual(state);
  });

  it('leaves every other field alone, including who the host is', () => {
    const state = createRoomStateFixture({
      status: 'answering',
      currentResponderId: 'participant-2',
      currentBuzzSession: { id: 'buzz-1', startedAt: 1_700_000_000_100 },
      buzzOrder: [{ participantId: 'participant-2', receivedAt: 1_700_000_000_100 }],
      currentSubmittedAnswer: submittedAnswer,
    });

    const { currentSubmittedAnswer, ...expected } = state;

    expect(toParticipantRoomState(state)).toEqual(expected);
    expect(currentSubmittedAnswer).toBe(submittedAnswer);
  });

  it('passes through a state that carries no answer yet', () => {
    const state = createRoomStateFixture({ status: 'answering' });

    expect(toParticipantRoomState(state)).toEqual(state);
  });
});
