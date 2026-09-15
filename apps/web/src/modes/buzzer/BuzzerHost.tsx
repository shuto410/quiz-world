/** Buzzer-specific host stage and judgement controls plug into the shared game panel. */
import type { UseRoomSocketResult } from '../../hooks/useRoomSocket';
import { Button } from '../../components/Button';
import { BuzzOrderList } from '../../components/BuzzOrderList';
import { GamePanel } from '../../components/GamePanel';
import { JudgePanel } from '../../components/JudgePanel';
import { LastResult } from '../../components/LastResult';
import { SubmittedAnswer } from '../../components/SubmittedAnswer';
import { hasNextResponder } from '../../game/hasNextResponder';
import { getBuzzerPrompt } from './getBuzzerPrompt';
import './buzzer.css';

/** Only the active connection supplies authoritative state and mode commands. */
type BuzzerHostProps = { connection: UseRoomSocketResult };
export function BuzzerHost({ connection }: BuzzerHostProps) {
  const { roomState, participantId, status, roomClosed, judge, resetGame } = connection;
  const responder = roomState?.participants.find(
    (person) => person.id === roomState.currentResponderId,
  );
  return (
    <GamePanel
      modeName="早押しクイズ"
      layout="split"
      contentPrimary={roomState?.status === 'result'}
      prominentTitle={
        status === 'joined' && roomState?.status === 'answering' && responder !== undefined
      }
      {...getBuzzerPrompt(roomState, participantId, status === 'joined' && !roomClosed)}
      {...(status === 'joined' && roomState?.status === 'answering' && responder
        ? { title: responder.name, description: '回答者' }
        : {})}
      controls={
        roomState?.status === 'answering' && responder ? (
          <fieldset
            disabled={status !== 'joined' || roomClosed}
            className="qw-room-controls"
            aria-label="進行"
          >
            <JudgePanel
              key={responder.id}
              responderName={responder.name}
              hasNextResponder={hasNextResponder({
                buzzOrder: roomState.buzzOrder,
                currentResponderId: roomState.currentResponderId,
              })}
              onJudge={(judgement) => judge({ participantId: responder.id, ...judgement })}
            />
          </fieldset>
        ) : roomState?.status === 'result' ? (
          <Button disabled={status !== 'joined' || roomClosed} onClick={resetGame}>
            次の問題へ
          </Button>
        ) : undefined
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
      {roomState?.status === 'answering' || roomState?.status === 'result' ? (
        <div className="qw-buzzer-answer">
          {roomState.status === 'result' ? (
            <LastResult result={roomState.lastResult} participants={roomState.participants} />
          ) : null}
          <SubmittedAnswer
            showSender={false}
            answer={roomState.currentSubmittedAnswer}
            participants={roomState.participants}
          />
        </div>
      ) : (
        <details className="qw-buzzer-guide">
          <summary>進行の流れ</summary>
          <ol>
            <li>問題を読み上げる</li>
            <li>早押しした人の回答を聞く</li>
            <li>正誤・得点を選び、次の進行先を押す</li>
          </ol>
        </details>
      )}
    </GamePanel>
  );
}
