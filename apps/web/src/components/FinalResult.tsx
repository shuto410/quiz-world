/**
 * The closing screen: who won, and where everyone finished.
 *
 * Both the host and the participants see the same table, computed from the broadcast scores
 * by `rankParticipants`. A joint first place is shown as several winners rather than being
 * broken by a rule the players never agreed to.
 */

import {
  DEFAULT_GAME_RULES,
  getParticipantStanding,
  type GameRules,
  type ParticipantState,
} from '@quiz-world/shared';
import { rankParticipants } from '../game/ranking';
import './FinalResult.css';

export type FinalResultProps = {
  rules?: GameRules | undefined;
  participants: readonly ParticipantState[];
  hostId: string | undefined;
};

export function FinalResult({
  participants,
  hostId,
  rules = DEFAULT_GAME_RULES,
}: FinalResultProps) {
  const ranked = rankParticipants({ participants, hostId, rules });

  if (ranked.length === 0) {
    return <p className="qw-final-result__empty">参加者がいないまま終了しました</p>;
  }

  const winners = ranked.filter((entry) => entry.isWinner);

  return (
    <div className="qw-final-result">
      <p className="qw-final-result__winners">
        <span className="qw-final-result__crown" aria-hidden="true">
          {rules.type === 'points' ? '優勝' : '勝ち抜け'}
        </span>
        <span className="qw-final-result__winner-names">
          {winners.length
            ? winners.map((entry) => entry.participant.name).join('、')
            : '勝ち抜け者なし'}
        </span>
        {rules.type === 'points' && winners.length > 1 ? (
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
            <span className="qw-final-result__score">
              {rules.type === 'points'
                ? `${participant.score}点`
                : `${participant.correctCount}○ ${participant.wrongCount}×${getParticipantStanding(participant, rules) === 'lost' ? ' · 失格' : ''}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
