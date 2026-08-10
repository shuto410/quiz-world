/**
 * Host room screen for step 8: join with the stored token and show the live participant list.
 *
 * Game controls arrive in later steps. What matters here is that creating a tournament and
 * opening this URL is enough for the host to see guests appear in real time.
 */

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { ParticipantList } from '../components/ParticipantList';
import { useToast } from '../components/Toast';
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

  const { status, roomState, participantId, errorMessage, leave } = useRoomSocket(joinRequest);

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
