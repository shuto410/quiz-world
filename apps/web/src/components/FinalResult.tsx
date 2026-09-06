/**
 * The closing screen: who won, and where everyone finished.
 *
 * Both the host and the participants see the same table, computed from the broadcast scores
 * by `rankParticipants`. A joint first place is shown as several winners rather than being
 * broken by a rule the players never agreed to.
 */

import type { ParticipantState } from '@quiz-world/shared';
import { rankParticipants } from '../game/ranking';
import './FinalResult.css';

export type FinalResultProps = {
  participants: readonly ParticipantState[];
  hostId: string | undefined;
};

export function FinalResult({ participants, hostId }: FinalResultProps) {
  const ranked = rankParticipants({ participants, hostId });

  if (ranked.length === 0) {
    return <p className="qw-final-result__empty">参加者がいないまま終了しました</p>;
  }

  const winners = ranked.filter((entry) => entry.isWinner);

  return (
    <div className="qw-final-result">
      <p className="qw-final-result__winners">
        <span className="qw-final-result__crown" aria-hidden="true">
          優勝
        </span>
        <span className="qw-final-result__winner-names">
          {winners.map((entry) => entry.participant.name).join('、')}
        </span>
        {winners.length > 1 ? (
          <span className="qw-final-result__tie">{winners.length}名が同点1位</span>
        ) : null}
      </p>

      <ol className="qw-final-result__table">
        {ranked.map(({ participant, rank, isWinner }) => (
          <li
            key={participant.id}
            className={[
              'qw-final-result__row',
              isWinner ? 'qw-final-result__row--winner' : '',
              participant.online ? '' : 'qw-final-result__row--offline',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="qw-final-result__rank">{rank}位</span>
            <span className="qw-final-result__name">{participant.name}</span>
            <span className="qw-final-result__score">{participant.score}点</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
