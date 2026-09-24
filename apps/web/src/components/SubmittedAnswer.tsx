/**
 * The text answer waiting to be judged, as shown on the host screen.
 *
 * It renders whatever the server sent and nothing more. Participants receive this field only
 * once the judgement is on screen, so the same component can be reused on the play screen
 * later without a second rule about who may read it: if the answer is in the state, it may
 * be shown.
 */

import type { ParticipantState, SubmittedAnswerState } from '@quiz-world/shared';
import './SubmittedAnswer.css';

/** Broadcast answer content and an optional caption for standalone presentation. */
export type SubmittedAnswerProps = {
  answer?: SubmittedAnswerState | undefined;
  participants: readonly ParticipantState[];
  /** Omit the repeated name when the surrounding stage already identifies the answerer. */
  showSender?: boolean;
};

export function SubmittedAnswer({ answer, participants, showSender = true }: SubmittedAnswerProps) {
  if (answer === undefined) {
    return <p className="qw-submitted-answer__empty">まだ回答は送信されていません</p>;
  }

  const sender = participants.find((participant) => participant.id === answer.participantId);

  return (
    <figure className="qw-submitted-answer">
      <blockquote className="qw-submitted-answer__text">{answer.answerText}</blockquote>
      {showSender ? (
        <figcaption className="qw-submitted-answer__sender">
          {sender?.name ?? '不明な参加者'} の回答
        </figcaption>
      ) : null}
    </figure>
  );
}
