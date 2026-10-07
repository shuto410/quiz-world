/**
 * Buzzer-specific host stage and judgement controls plug into the shared game panel.
 *
 * The verdict buttons never leave the bar, so the host's hand does not have to follow them.
 * What a press does depends on the server's state: it judges the responder while one waits,
 * and otherwise only plays the correct/wrong cue for the room.
 */
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
  const {
    roomState,
    participantId,
    status,
    roomClosed,
    judge,
    playEffect,
    resetGame,
    nextResponder,
  } = connection;
  const responder = roomState?.participants.find(
    (person) => person.id === roomState.currentResponderId,
  );
  // A press judges only while this seat waits for a verdict; otherwise it plays the cue.
  const judging = roomState?.status === 'answering' && responder !== undefined;
  // Display only: the responder's place in the server's buzz order.
  const responderPlace =
    responder && roomState
      ? roomState.buzzOrder.findIndex((entry) => entry.participantId === responder.id) + 1
      : 0;
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
        ? {
            title: responder.name,
            description: responderPlace > 0 ? `回答中(${responderPlace}着)` : '回答中',
          }
        : {})}
      controls={
        roomState !== undefined && roomState.status !== 'finished' ? (
          <fieldset
            disabled={status !== 'joined' || roomClosed}
            className="qw-room-controls qw-buzzer-host-controls"
            aria-label="進行"
          >
            {/* Always present. With a responder a press judges; otherwise it only cues. */}
            <JudgePanel
              key={judging ? responder.id : 'effect'}
              responderName={judging ? responder.name : undefined}
              rules={roomState.rules}
              disabled={
                roomState.status === 'paused' || (roomState.status === 'answering' && !judging)
              }
              onJudge={(judgement) => {
                if (!judging) playEffect(judgement.isCorrect);
                else if (roomState.currentBuzzSession)
                  judge({
                    participantId: responder.id,
                    buzzSessionId: roomState.currentBuzzSession.id,
                    ...judgement,
                  });
              }}
            />
            {roomState.status === 'result' ? (
              <div className="qw-buzzer-progress">
                <Button onClick={resetGame}>次の問題へ</Button>
                {roomState.lastResult?.isCorrect === false ? (
                  <Button
                    disabled={
                      !hasNextResponder({
                        buzzOrder: roomState.buzzOrder,
                        currentResponderId: roomState.currentResponderId,
                      })
                    }
                    onClick={nextResponder}
                  >
                    次の回答者へ
                  </Button>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        ) : undefined
      }
      supplement={
        roomState !== undefined ? (
          <section aria-label="早押し順">
            <h3>押した順</h3>
            <BuzzOrderList
              rules={roomState.rules}
              buzzOrder={roomState?.buzzOrder ?? []}
              participants={roomState?.participants ?? []}
              currentResponderId={
                roomState.status === 'answering' ? roomState.currentResponderId : undefined
              }
            />
          </section>
        ) : undefined
      }
    >
      {roomState?.status === 'answering' || roomState?.status === 'result' ? (
        <div className="qw-buzzer-answer">
          {roomState.lastResult ? (
            <LastResult
              rules={roomState.rules}
              result={roomState.lastResult}
              participants={roomState.participants}
            />
          ) : null}
          {roomState.status === 'answering' || roomState.currentSubmittedAnswer ? (
            <SubmittedAnswer
              showSender={false}
              answer={roomState.currentSubmittedAnswer}
              participants={roomState.participants}
            />
          ) : null}
        </div>
      ) : (
        <details className="qw-buzzer-guide">
          <summary>進行の流れ</summary>
          <ol>
            <li>問題を読み上げる</li>
            <li>早押しした人の回答を聞く</li>
            <li>正解・不正解を押して判定を伝える</li>
          </ol>
        </details>
      )}
    </GamePanel>
  );
}
