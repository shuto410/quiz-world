/**
 * Host room screen: join with the stored token, watch the roster, follow the buzz order and
 * read the answer that is waiting to be judged.
 *
 * The submitted answer is on this screen and nowhere else until the judgement is shown. That
 * is not enforced here: the server strips the field from the participants' copy of the
 * state, so this screen simply renders what only it receives.
 *
 * The progression area shows one thing at a time, chosen by the room status, so that the
 * only controls on screen are the ones the server would currently accept. Ending the
 * tournament arrives in a later step.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { BuzzOrderList } from '../components/BuzzOrderList';
import { JudgePanel } from '../components/JudgePanel';
import { LastResult } from '../components/LastResult';
import { ParticipantList } from '../components/ParticipantList';
import { SubmittedAnswer } from '../components/SubmittedAnswer';
import { useToast } from '../components/Toast';
import { hasNextResponder } from '../game/hasNextResponder';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { ROUTE_PATHS } from '../routes';
import { loadHostToken, loadInviteDetails } from '../storage/sessionKeys';

export function HostPage() {
  const { tournamentId } = useParams();
  const toast = useToast();
  const hostToken = tournamentId === undefined ? undefined : loadHostToken(tournamentId);
  const inviteDetails = tournamentId === undefined ? undefined : loadInviteDetails(tournamentId);
  const [copied, setCopied] = useState(false);

  const joinRequest = useMemo(() => {
    if (tournamentId === undefined || hostToken === undefined) {
      return undefined;
    }
    return { kind: 'host' as const, tournamentId, hostToken };
  }, [tournamentId, hostToken]);

  const {
    status,
    roomState,
    participantId,
    errorMessage,
    socketError,
    clearSocketError,
    leave,
    judge,
    resetGame,
  } = useRoomSocket(joinRequest);

  useEffect(() => {
    if (socketError === undefined) {
      return;
    }
    toast.show(socketError.message, 'error');
    clearSocketError();
  }, [socketError, clearSocketError, toast.show]);

  const responder = roomState?.participants.find(
    (participant) => participant.id === roomState.currentResponderId,
  );

  if (tournamentId === undefined) {
    return (
      <main className="app-shell">
        <h1>ホスト進行</h1>
        <p>大会が見つかりません。</p>
      </main>
    );
  }

  if (hostToken === undefined) {
    return (
      <main className="app-shell">
        <h1>ホスト進行</h1>
        <p>
          このブラウザにホストトークンがありません。大会を作成し直すか、参加画面から入ってください。
        </p>
        <p>
          <Link to={ROUTE_PATHS.home}>トップへ</Link>
        </p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="app-shell">
        <h1>ホスト進行</h1>
        <p>{errorMessage ?? '参加に失敗しました'}</p>
        <p>
          <Link to={ROUTE_PATHS.home}>トップへ</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1>ホスト進行</h1>
      <p>
        {inviteDetails?.name ?? '大会'} — {status === 'joined' ? '接続中' : '接続しています…'}
      </p>

      {inviteDetails !== undefined ? (
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
      ) : null}

      <section className="qw-room-section" aria-label="進行">
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
        {roomState?.status === 'finished' ? <p>大会は終了しました。</p> : null}
      </section>

      <section className="qw-room-section" aria-label="早押し順">
        <h2>早押し順</h2>
        <BuzzOrderList
          buzzOrder={roomState?.buzzOrder ?? []}
          participants={roomState?.participants ?? []}
          currentResponderId={roomState?.currentResponderId}
        />
      </section>

      <section className="qw-room-section" aria-label="テキスト回答">
        <h2>回答</h2>
        <SubmittedAnswer
          answer={roomState?.currentSubmittedAnswer}
          participants={roomState?.participants ?? []}
        />
      </section>

      <section className="qw-room-section" aria-label="参加者一覧">
        <h2>参加者</h2>
        <ParticipantList
          participants={roomState?.participants ?? []}
          selfParticipantId={participantId}
          hostId={roomState?.hostId}
        />
      </section>

      <div className="qw-room-actions">
        <Button
          type="button"
          onClick={() => {
            leave();
            toast.show('退出しました');
          }}
        >
          退出
        </Button>
      </div>
    </main>
  );
}
