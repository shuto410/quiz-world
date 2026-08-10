/**
 * Shared participant roster for host and play screens.
 *
 * Renders what the server broadcasts — order, online flag and score — without deriving host
 * or buzz flags. Those stay computed at the call site from `hostId` / `buzzOrder` when needed.
 */

import type { ParticipantState } from '@quiz-world/shared';
import './ParticipantList.css';

export type ParticipantListProps = {
  participants: readonly ParticipantState[];
  /** Highlight the viewer's own seat when known. */
  selfParticipantId?: string | undefined;
  hostId?: string | undefined;
};

export function ParticipantList({ participants, selfParticipantId, hostId }: ParticipantListProps) {
  if (participants.length === 0) {
    return <p className="qw-participant-list__empty">まだ参加者はいません</p>;
  }

  return (
    <ul className="qw-participant-list">
      {participants.map((participant) => {
        const isSelf = participant.id === selfParticipantId;
        const isHost = participant.id === hostId;
        return (
          <li
            key={participant.id}
            className={[
              'qw-participant-list__row',
              participant.online ? '' : 'qw-participant-list__row--offline',
              isSelf ? 'qw-participant-list__row--self' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="qw-participant-list__name">
              {participant.name}
              {isHost ? <span className="qw-participant-list__tag">ホスト</span> : null}
              {isSelf ? <span className="qw-participant-list__tag">あなた</span> : null}
            </span>
            <span className="qw-participant-list__meta">
              <span className="qw-participant-list__status">
                {participant.online ? 'オンライン' : 'オフライン'}
              </span>
              <span className="qw-participant-list__score">{participant.score}点</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
