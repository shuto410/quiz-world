/**
 * The judgement currently on screen, shown to the host and the participants alike.
 *
 * The running total is not repeated here; it is in the roster, which the same broadcast
 * updated. This shows only what the last judgement decided, which is the part that would
 * otherwise be invisible once the score has been folded in.
 */

import type { LastResultState, ParticipantState } from '@quiz-world/shared';
import { formatScoreDelta } from '../game/scoreDelta';
import './LastResult.css';

export type LastResultProps = {
  result: LastResultState | undefined;
  participants: readonly ParticipantState[];
};

export function LastResult({ result, participants }: LastResultProps) {
  if (result === undefined) {
    return null;
  }

  const judged = participants.find((participant) => participant.id === result.participantId);

  return (
    <p className={`qw-last-result qw-last-result--${result.isCorrect ? 'correct' : 'wrong'}`}>
      <span className="qw-last-result__name">{judged?.name ?? '不明な参加者'}</span>
      <span className="qw-last-result__verdict">{result.isCorrect ? '正解' : '不正解'}</span>
      <span className="qw-last-result__delta">{formatScoreDelta(result.scoreDelta)}点</span>
    </p>
  );
}
