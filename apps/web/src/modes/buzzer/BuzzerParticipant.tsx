/** Participant buzzer and text-answer controls share a stable stage across round transitions. */
import type { UseRoomSocketResult } from '../../hooks/useRoomSocket';
import { AnswerForm } from '../../components/AnswerForm';
import { Button } from '../../components/Button';
import { BuzzOrderList } from '../../components/BuzzOrderList';
import { GamePanel } from '../../components/GamePanel';
import { LastResult } from '../../components/LastResult';
import { SubmittedAnswer } from '../../components/SubmittedAnswer';
import { useToast } from '../../components/Toast';
import { canBuzz } from '../../game/canBuzz';
import { canSubmitAnswer } from '../../game/canSubmitAnswer';
import { getBuzzerPrompt } from './getBuzzerPrompt';
import './buzzer.css';

/** Mode commands and the viewer's server-assigned seat. */
type BuzzerParticipantProps = { connection: UseRoomSocketResult };
export function BuzzerParticipant({ connection }: BuzzerParticipantProps) {
  const { roomState, participantId, status, roomClosed, buzz, submitAnswer } = connection;
  const toast = useToast();
  const showAnswerInput =
    (roomState?.status === 'answering' ||
      (roomState?.status === 'paused' && roomState.statusBeforePause === 'answering')) &&
    participantId !== undefined &&
    participantId === roomState.currentResponderId;
  const connected = status === 'joined' && !roomClosed;
  const buzzEnabled =
    connected &&
    canBuzz({
      status: roomState?.status,
      participantId,
      hostId: roomState?.hostId,
      buzzOrder: roomState?.buzzOrder,
    });
  const answerEnabled =
    connected &&
    canSubmitAnswer({
      status: roomState?.status,
      participantId,
      currentResponderId: roomState?.currentResponderId,
    });
  return (
    <GamePanel
      modeName="早押しクイズ"
      contentPrimary={roomState?.status === 'result'}
      highlighted={answerEnabled}
      prominentTitle={answerEnabled}
      {...getBuzzerPrompt(roomState, participantId, connected)}
      controls={
        roomState?.status === 'result' ? undefined : (
          <div className="qw-buzzer-controls" data-answering={showAnswerInput}>
            {showAnswerInput ? (
              <div className="qw-buzzer-controls__answer">
                <h3>テキストで回答</h3>
                <AnswerForm
                  disabled={!answerEnabled}
                  onSubmit={(answerText) => {
                    submitAnswer(answerText);
                    toast.show('回答を送信しました');
                  }}
                />
                <p>回答は判定までホストだけに表示されます。</p>
              </div>
            ) : (
              <div className="qw-buzzer-controls__buzz">
                <Button className="qw-buzzer-button" disabled={!buzzEnabled} onClick={buzz}>
                  <svg
                    className="qw-buzzer-symbol"
                    viewBox="0 0 48 40"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 32h34M12 27a12 12 0 0 1 24 0H12ZM24 4v6M7 10l4 4M41 10l-4 4"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  早押し
                </Button>
                <p>{buzzEnabled ? '回答は声でもテキストでも' : '現在は早押しできません'}</p>
              </div>
            )}
          </div>
        )
      }
      supplement={
        roomState !== undefined && roomState.buzzOrder.length > 0 ? (
          <section aria-label="早押し順">
            <h3>早押し順</h3>
            <BuzzOrderList
              buzzOrder={roomState?.buzzOrder ?? []}
              participants={roomState?.participants ?? []}
              currentResponderId={roomState?.currentResponderId}
            />
          </section>
        ) : undefined
      }
    >
      {roomState?.status === 'result' ? (
        <div className="qw-buzzer-answer">
          <LastResult result={roomState.lastResult} participants={roomState.participants} />
          <SubmittedAnswer
            showSender={false}
            answer={roomState.currentSubmittedAnswer}
            participants={roomState.participants}
          />
        </div>
      ) : null}
    </GamePanel>
  );
}
