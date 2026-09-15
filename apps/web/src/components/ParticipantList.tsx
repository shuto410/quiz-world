/** Presents server scores as standings, keeping the host outside the competition. */
import type { ParticipantState } from '@quiz-world/shared';
import { rankParticipants } from '../game/ranking';
import { ParticipantToken } from './ParticipantToken';
import './ParticipantList.css';

/** The broadcast roster and optional viewer identity, without stored ranking fields. */
export type ParticipantListProps = {
  participants: readonly ParticipantState[];
  selfParticipantId?: string | undefined;
  hostId?: string | undefined;
  currentResponderId?: string | undefined;
};

export function ParticipantList({
  participants,
  selfParticipantId,
  hostId,
  currentResponderId,
}: ParticipantListProps) {
  const host = participants.find((person) => person.id === hostId);
  const ranked = rankParticipants({ participants, hostId });
  return (
    <div className="qw-scoreboard">
      {ranked.length === 0 ? (
        <p className="qw-participant-list__empty">まだ参加者はいません</p>
      ) : (
        <ol className="qw-participant-list">
          {ranked.map(({ participant, rank }) => (
            <li
              key={participant.id}
              className="qw-participant-list__row"
              data-self={participant.id === selfParticipantId}
              data-responding={participant.id === currentResponderId}
            >
              <span className="qw-participant-list__rank" aria-label={`${rank}位`}>
                {rank}
              </span>
              <div className="qw-participant-list__identity">
                <span className="qw-participant-list__name">
                  <ParticipantToken
                    participantId={participant.id}
                    active={participant.id === currentResponderId}
                  />
                  <span>{participant.name}</span>
                </span>
                <span className="qw-participant-list__meta">
                  {participant.id === currentResponderId ? (
                    <span className="qw-participant-list__turn">回答中</span>
                  ) : null}
                  {participant.id === selfParticipantId ? (
                    <span className="qw-participant-list__tag">あなた</span>
                  ) : null}
                  <span className="qw-participant-list__status" data-online={participant.online}>
                    {participant.online ? 'オンライン' : 'オフライン'}
                  </span>
                </span>
              </div>
              <span
                key={participant.score}
                className="qw-participant-list__score"
                aria-label={`${participant.score}点`}
              >
                {participant.score}
                <span>点</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {host ? (
        <div className="qw-scoreboard__host">
          <span className="qw-scoreboard__host-label">進行役</span>
          <strong>{host.name}</strong>
          <span className="qw-participant-list__status" data-online={host.online}>
            {host.online ? 'オンライン' : 'オフライン'}
          </span>
        </div>
      ) : null}
    </div>
  );
}
