/**
 * Ranked list of accepted buzzes for the current round.
 *
 * Rank is the array index from the server; this component only resolves display names and
 * marks who currently holds the answer right. It does not invent an order of its own. Each
 * row also shows how far behind the first buzz it reached the server, as text and as a bar
 * (the bar is drawn only in the large size).
 */

import type { BuzzEntry, GameRules, ParticipantState } from '@quiz-world/shared';
import { describeBuzzGaps } from '../game/buzzGap';
import { ParticipantToken } from './ParticipantToken';
import './BuzzOrderList.css';

export type BuzzOrderListProps = {
  buzzOrder: readonly BuzzEntry[];
  participants: readonly ParticipantState[];
  currentResponderId?: string | undefined;
  /** When given, each row also shows the seat's current score (or ○× counts). */
  rules?: GameRules | undefined;
};

function displayNameFor(participantId: string, participants: readonly ParticipantState[]): string {
  const seat = participants.find((participant) => participant.id === participantId);
  return seat?.name ?? '不明な参加者';
}

function scoreFor(
  participantId: string,
  participants: readonly ParticipantState[],
  rules: GameRules,
): string | undefined {
  const seat = participants.find((participant) => participant.id === participantId);
  if (seat === undefined) return undefined;
  return rules.type === 'maruBatsu'
    ? `${seat.correctCount}○ ${seat.wrongCount}×`
    : `${seat.score}点`;
}

export function BuzzOrderList({
  buzzOrder,
  participants,
  currentResponderId,
  rules,
}: BuzzOrderListProps) {
  if (buzzOrder.length === 0) {
    return <p className="qw-buzz-order__empty">まだ早押しはありません</p>;
  }

  const gaps = describeBuzzGaps(buzzOrder);
  return (
    <ol className="qw-buzz-order">
      {buzzOrder.map((entry, index) => {
        const isResponder = entry.participantId === currentResponderId;
        const gap = gaps[index];
        return (
          <li
            key={`${entry.participantId}-${entry.receivedAt}`}
            className={['qw-buzz-order__row', isResponder ? 'qw-buzz-order__row--responder' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <span className="qw-buzz-order__rank">{index + 1}</span>
            <span className="qw-buzz-order__name">
              <ParticipantToken participantId={entry.participantId} active={isResponder} />
              <span className="qw-buzz-order__who">
                <span>{displayNameFor(entry.participantId, participants)}</span>
                {rules ? (
                  <small className="qw-buzz-order__score">
                    {scoreFor(entry.participantId, participants, rules)}
                  </small>
                ) : null}
              </span>
            </span>
            <span className="qw-buzz-order__bar" aria-hidden="true">
              <span style={{ width: `${(gap?.barRatio ?? 0) * 100}%` }} />
            </span>
            {isResponder ? <span className="qw-buzz-order__tag">回答権</span> : null}
            <span className="qw-buzz-order__gap" data-first={index === 0}>
              {gap?.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
