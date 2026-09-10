/** Renders host controls on either route without reconnecting when authority changes. */
import { useState } from 'react';
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
import type { StoredInviteDetails } from '../storage/sessionKeys';
import { RoomFrame } from './RoomFrame';
import { Button } from './Button';
import { BuzzOrderList } from './BuzzOrderList';
import { ConfirmButton } from './ConfirmButton';
import { FinalResult } from './FinalResult';
import { JudgePanel } from './JudgePanel';
import { LastResult } from './LastResult';
import { ParticipantList } from './ParticipantList';
import { SubmittedAnswer } from './SubmittedAnswer';
import { useToast } from './Toast';
import { hasNextResponder } from '../game/hasNextResponder';

/** State and optional creation-time invite information for a host screen. */
type HostRoomViewProps = { connection: UseRoomSocketResult; inviteDetails?: StoredInviteDetails };
export function HostRoomView({ connection, inviteDetails }: HostRoomViewProps) {
  const {
    status,
    roomState,
    participantId,
    errorMessage,
    leave,
    judge,
    resetGame,
    finishTournament,
    closeRoom,
    roomClosed,
  } = connection;
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const responder = roomState?.participants.find(
    (participant) => participant.id === roomState.currentResponderId,
  );

  const connectionLabel = roomClosed
    ? 'ルームを閉じました'
    : status === 'joined'
      ? '接続中'
      : (errorMessage ??
        (roomState === undefined ? '接続しています…' : '接続が切れました。再接続しています…'));

  return (
    <RoomFrame
      title={inviteDetails?.name ?? 'ホスト進行'}
      connectionLabel={connectionLabel}
      sidebar={
        inviteDetails !== undefined ? (
          <section className="qw-invite-panel" aria-label="招待情報">
            <p>
              招待コード: <code>{inviteDetails.inviteCode}</code>
            </p>
            <p className="qw-invite-panel__url">{inviteDetails.inviteUrl}</p>
            <Button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(inviteDetails.inviteUrl).then(
                  () => {
                    setCopied(true);
                    toast.show('招待URLをコピーしました');
                  },
                  () => {
                    toast.show('コピーに失敗しました', 'error');
                  },
                );
              }}
            >
              {copied ? 'コピー済み' : '招待URLをコピー'}
            </Button>
          </section>
        ) : null
      }
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
      {roomState?.status !== 'finished' ? (
        <section className="qw-room-section" aria-label="テキスト回答">
          <h2>回答</h2>
          <SubmittedAnswer
            answer={roomState?.currentSubmittedAnswer}
            participants={roomState?.participants ?? []}
          />
        </section>
      ) : null}
      {roomState?.status !== 'finished' ? (
        <fieldset
          disabled={status !== 'joined'}
          className="qw-room-section qw-room-controls"
          aria-label="進行"
        >
          <h2>進行</h2>
          {roomState?.status === 'answering' && responder !== undefined ? (
            <JudgePanel
              responderName={responder.name}
              hasNextResponder={hasNextResponder({
                buzzOrder: roomState.buzzOrder,
                currentResponderId: roomState.currentResponderId,
              })}
              onJudge={({ isCorrect, scoreDelta, nextAction }) => {
                judge({ participantId: responder.id, isCorrect, scoreDelta, nextAction });
              }}
            />
          ) : null}

          {roomState?.status === 'result' ? (
            <div className="qw-host-progress">
              <LastResult result={roomState.lastResult} participants={roomState.participants} />
              <Button
                className="qw-next-question"
                onClick={() => {
                  resetGame();
                }}
              >
                次の問題へ
              </Button>
            </div>
          ) : null}

          {roomState?.status === 'idle' ? <p>早押しを待っています。</p> : null}
          {roomState?.status === 'paused' ? <p>一時停止中です。</p> : null}

          {roomState?.status === 'idle' || roomState?.status === 'result' ? (
            <div className="qw-host-progress">
              <ConfirmButton
                label="大会終了"
                question="大会を終了して最終結果を表示しますか？ 終了後は早押しできません。"
                confirmLabel="終了する"
                onConfirm={() => {
                  finishTournament();
                }}
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {roomState?.status === 'finished' ? (
        <section className="qw-room-section" aria-label="最終結果">
          <h2>最終結果</h2>
          <FinalResult participants={roomState.participants} hostId={roomState.hostId} />
          <fieldset disabled={status !== 'joined'} className="qw-host-progress qw-room-controls">
            {roomClosed ? (
              <p>ルームを閉じました。</p>
            ) : (
              <ConfirmButton
                label="ルームを閉じる"
                question="ルームを閉じると全員の接続が切れます。よろしいですか？"
                confirmLabel="閉じる"
                onConfirm={() => {
                  closeRoom();
                }}
              />
            )}
          </fieldset>
        </section>
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
