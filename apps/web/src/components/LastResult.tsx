/**
 * The judgement currently on screen, shown to the host and the participants alike.
 *
 * The running total is not repeated here; it is in the roster, which the same broadcast
 * updated. This shows only what the last judgement decided, which is the part that would
 * otherwise be invisible once the score has been folded in.
 */

import type { GameRules, LastResultState, ParticipantState } from '@quiz-world/shared';
import { DEFAULT_GAME_RULES, getParticipantStanding } from '@quiz-world/shared';
import { formatScoreDelta } from '../game/scoreDelta';
import './LastResult.css';

export type LastResultProps = {
  rules?: GameRules | undefined;
  result: LastResultState | undefined;
  participants: readonly ParticipantState[];
};

export function LastResult({ result, participants, rules = DEFAULT_GAME_RULES }: LastResultProps) {
  if (result === undefined) {
    return null;
  }

  const judged = participants.find((participant) => participant.id === result.participantId);

  const standing = judged ? getParticipantStanding(judged, rules) : 'playing';
  return (
    <p
      role="status"
      aria-atomic="true"
      className={`qw-last-result qw-last-result--${result.isCorrect ? 'correct' : 'wrong'}`}
    >
      <span className="qw-last-result__name">{judged?.name ?? '不明な参加者'}</span>
      <span className="qw-last-result__verdict">{result.isCorrect ? '○ 正解' : '× 不正解'}</span>
      <span className="qw-last-result__delta">{formatScoreDelta(result.scoreDelta)}点</span>
      {judged ? (
        <span className="qw-last-result__counts">
          {judged.correctCount}○ {judged.wrongCount}×
          {standing === 'won' ? ' · 勝ち抜け' : standing === 'lost' ? ' · 失格' : ''}
        </span>
      ) : null}
    </p>
  );
}
