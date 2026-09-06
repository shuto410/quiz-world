/**
 * Ranked list of accepted buzzes for the current round.
 *
 * Rank is the array index from the server; this component only resolves display names and
 * marks who currently holds the answer right. It does not invent an order of its own.
 */

import type { BuzzEntry, ParticipantState } from '@quiz-world/shared';
import './BuzzOrderList.css';

export type BuzzOrderListProps = {
  buzzOrder: readonly BuzzEntry[];
  participants: readonly ParticipantState[];
  currentResponderId?: string | undefined;
};

function displayNameFor(participantId: string, participants: readonly ParticipantState[]): string {
  const seat = participants.find((participant) => participant.id === participantId);
  return seat?.name ?? '不明な参加者';
}

export function BuzzOrderList({ buzzOrder, participants, currentResponderId }: BuzzOrderListProps) {
  if (buzzOrder.length === 0) {
    return <p className="qw-buzz-order__empty">まだ早押しはありません</p>;
  }

  return (
    <ol className="qw-buzz-order">
      {buzzOrder.map((entry, index) => {
        const isResponder = entry.participantId === currentResponderId;
        return (
          <li
            key={`${entry.participantId}-${entry.receivedAt}`}
            className={['qw-buzz-order__row', isResponder ? 'qw-buzz-order__row--responder' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <span className="qw-buzz-order__rank">{index + 1}</span>
            <span className="qw-buzz-order__name">
              {displayNameFor(entry.participantId, participants)}
              {isResponder ? <span className="qw-buzz-order__tag">回答権</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
