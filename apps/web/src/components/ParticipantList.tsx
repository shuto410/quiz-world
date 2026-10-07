/**
 * Presents server scores as standings, keeping the host outside the competition.
 *
 * When the parent passes `onAdjust`, each row also offers the host a way to correct that seat.
 * Whether that is allowed right now is the parent's reading of the room state; this component
 * only draws the control and forwards what the form produced.
 */
import { useState } from 'react';
import {
  DEFAULT_GAME_RULES,
  getParticipantStanding,
  type GameRules,
  type ParticipantState,
  type ScoreAdjustPayload,
} from '@quiz-world/shared';
import { rankParticipants } from '../game/ranking';
import { ParticipantToken } from './ParticipantToken';
import { ScoreEditor } from './ScoreEditor';
import './ParticipantList.css';

/** The broadcast roster and optional viewer identity, without stored ranking fields. */
export type ParticipantListProps = {
  rules?: GameRules | undefined;
  participants: readonly ParticipantState[];
  selfParticipantId?: string | undefined;
  hostId?: string | undefined;
  currentResponderId?: string | undefined;
  /** Present only for a host while corrections are accepted; shows the per-row edit control. */
  onAdjust?: ((payload: ScoreAdjustPayload) => void) | undefined;
  /** True while the connection is down. The control stays visible but cannot be used. */
  adjustDisabled?: boolean | undefined;
};

export function ParticipantList({
  participants,
  rules = DEFAULT_GAME_RULES,
  selfParticipantId,
  hostId,
  currentResponderId,
  onAdjust,
  adjustDisabled = false,
}: ParticipantListProps) {
  const [editingId, setEditingId] = useState<string>();
  const host = participants.find((person) => person.id === hostId);
  const ranked = rankParticipants({ participants, hostId, rules });
  return (
    <div className="qw-scoreboard">
      {ranked.length === 0 ? (
        <p className="qw-participant-list__empty">まだ参加者はいません</p>
      ) : (
        <ol className="qw-participant-list" data-rule={rules.type}>
          {ranked.map(({ participant, rank }) => (
            <li
              key={participant.id}
              className="qw-participant-list__row"
              data-self={participant.id === selfParticipantId}
              data-responding={participant.id === currentResponderId}
              data-first={rank === 1}
              data-editing={onAdjust !== undefined && editingId === participant.id}
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
              <div className="qw-participant-list__numbers">
                <span
                  className="qw-participant-list__counts"
                  aria-label={`正解${participant.correctCount}回、誤答${participant.wrongCount}回`}
                >
                  <span>{participant.correctCount}○</span> <span>{participant.wrongCount}×</span>
                </span>
                {getParticipantStanding(participant, rules) !== 'playing' ? (
                  <span className="qw-participant-list__standing">
                    {getParticipantStanding(participant, rules) === 'won' ? '勝ち抜け' : '失格'}
                  </span>
                ) : null}
                {rules.type === 'points' ? (
                  <span
                    key={participant.score}
                    className="qw-participant-list__score"
                    aria-label={`${participant.score}点`}
                  >
                    {participant.score}
                    <span>点</span>
                  </span>
                ) : null}
                {onAdjust ? (
                  <button
                    type="button"
                    className="qw-participant-list__edit"
                    aria-label={`${participant.name}さんの得点を修正`}
                    aria-expanded={editingId === participant.id}
                    disabled={adjustDisabled}
                    onClick={() => {
                      setEditingId(editingId === participant.id ? undefined : participant.id);
                    }}
                  >
                    修正
                  </button>
                ) : null}
              </div>
              {onAdjust && editingId === participant.id ? (
                <ScoreEditor
                  key={rules.type}
                  participant={participant}
                  rules={rules}
                  disabled={adjustDisabled}
                  onSave={(adjustment) => {
                    onAdjust({ participantId: participant.id, adjustment });
                    setEditingId(undefined);
                  }}
                  onCancel={() => {
                    setEditingId(undefined);
                  }}
                />
              ) : null}
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
