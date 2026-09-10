/** Renders participant play and takeover controls while keeping the active socket mounted. */
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
import { AnswerForm } from './AnswerForm';
import { RoomFrame } from './RoomFrame';
import { Button } from './Button';
import { BuzzOrderList } from './BuzzOrderList';
import { FinalResult } from './FinalResult';
import { LastResult } from './LastResult';
import { ParticipantList } from './ParticipantList';
import { SubmittedAnswer } from './SubmittedAnswer';
import { useToast } from './Toast';
import { canBuzz } from '../game/canBuzz';
import { canSubmitAnswer } from '../game/canSubmitAnswer';

/** Connection state shared with the host view and the displayed seat name. */
type ParticipantRoomViewProps = { connection: UseRoomSocketResult; displayName: string };
export function ParticipantRoomView({ connection, displayName }: ParticipantRoomViewProps) {
  const {
    status,
    roomState,
    participantId,
    errorMessage,
    leave,
    buzz,
    submitAnswer,
    roomClosed,
    claimHost,
  } = connection;
  const toast = useToast();
  const buzzEnabled =
    status === 'joined' &&
    canBuzz({
      status: roomState?.status,
      participantId,
      hostId: roomState?.hostId,
      buzzOrder: roomState?.buzzOrder,
    });

  const answerEnabled =
    status === 'joined' &&
    canSubmitAnswer({
      status: roomState?.status,
      participantId,
      currentResponderId: roomState?.currentResponderId,
    });

  const connectionLabel = roomClosed
    ? 'ホストがルームを閉じました'
    : status === 'joined'
      ? '接続中'
      : (errorMessage ??
        (roomState === undefined ? '接続しています…' : '接続が切れました。再接続しています…'));

  return (
    <RoomFrame
      title="プレイ"
      connectionLabel={connectionLabel}
      sidebar={<p className="qw-sidebar__identity">{displayName} として参加中</p>}
      roster={
        <section className="qw-room-section" aria-label="参加者一覧">
          <h2>参加者</h2>
          <ParticipantList
            participants={roomState?.participants ?? []}
            selfParticipantId={participantId}
            hostId={roomState?.hostId}
          />
        </section>
      }
      actions={
        <div className="qw-room-actions">
          <Button
            type="button"
            disabled={status !== 'joined'}
            onClick={() => {
              leave();
              toast.show('退出しました');
            }}
          >
            退出
          </Button>
        </div>
      }
    >
      {roomState?.status === 'paused' && roomState.pausedReason === 'hostDisconnected' ? (
        <section className="qw-room-section" aria-label="ホストの切断">
          <h2>ホストの接続が切れたため一時停止中です</h2>
          <p>ホストの復帰を待つか、進行役を引き継いで再開できます。</p>
          <Button disabled={status !== 'joined'} onClick={claimHost}>
            ホストを引き継ぐ
          </Button>
        </section>
      ) : null}
      <div className="qw-stage-intro">
        <h2>
          {roomState?.status === 'finished'
            ? '大会終了'
            : answerEnabled
              ? 'あなたの回答番です。'
              : buzzEnabled
                ? '早押し受付中'
                : 'ホストの進行を待っています'}
        </h2>
        <p>
          {roomState?.status === 'finished'
            ? '最終スコアと順位をご確認ください。'
            : '回答権を得たら、声またはテキストで回答してください。'}
        </p>
      </div>

      {roomState?.status === 'finished' ? (
        <section className="qw-room-section" aria-label="最終結果">
          <h2>最終結果</h2>
          <FinalResult participants={roomState.participants} hostId={roomState.hostId} />
        </section>
      ) : null}

      {roomState?.status === 'result' ? (
        <section className="qw-room-section" aria-label="判定結果">
          <h2>判定</h2>
          <LastResult result={roomState.lastResult} participants={roomState.participants} />
          <SubmittedAnswer
            answer={roomState.currentSubmittedAnswer}
            participants={roomState.participants}
          />
        </section>
      ) : null}

      {roomState?.status !== 'finished' ? (
        <div className="qw-buzz-bar">
          <AnswerForm
            disabled={!answerEnabled}
            onSubmit={(answerText) => {
              submitAnswer(answerText);
              toast.show('回答を送信しました');
            }}
          />
          <Button
            type="button"
            disabled={!buzzEnabled}
            onClick={() => {
              buzz();
            }}
          >
            早押し
          </Button>
          {!buzzEnabled && status === 'joined' ? (
            <p className="qw-buzz-bar__hint">いまは押せません</p>
          ) : null}
        </div>
      ) : null}
      {roomState?.status !== 'finished' ? (
        <section className="qw-room-section" aria-label="早押し順">
          <h2>早押し順</h2>
          <BuzzOrderList
            buzzOrder={roomState?.buzzOrder ?? []}
            participants={roomState?.participants ?? []}
            currentResponderId={roomState?.currentResponderId}
          />
        </section>
      ) : null}
    </RoomFrame>
  );
}
