/**
 * Participant play screen: join with a display name, watch the roster, and press the buzzer.
 *
 * The buzzer is pinned to the bottom of the viewport. Whether it is enabled is derived from
 * the broadcast state (`canBuzz`) so a disabled button matches what the server would refuse.
 * Answer text UI arrives in a later step.
 */

import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { BuzzOrderList } from '../components/BuzzOrderList';
import { ParticipantList } from '../components/ParticipantList';
import { useToast } from '../components/Toast';
import { canBuzz } from '../game/canBuzz';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { joinPath, ROUTE_PATHS } from '../routes';
import { loadParticipantId } from '../storage/sessionKeys';
import type { PlayNavigationState } from './JoinPage';

export function PlayPage() {
  const { tournamentId } = useParams();
  const location = useLocation();
  const toast = useToast();
  const navState = location.state as PlayNavigationState | null;
  const displayName = navState?.displayName;

  const joinRequest = useMemo(() => {
    if (tournamentId === undefined || displayName === undefined) {
      return undefined;
    }
    return {
      kind: 'participant' as const,
      tournamentId,
      displayName,
      participantId: loadParticipantId(tournamentId),
    };
  }, [tournamentId, displayName]);

  const {
    status,
    roomState,
    participantId,
    errorMessage,
    socketError,
    clearSocketError,
    leave,
    buzz,
  } = useRoomSocket(joinRequest);

  useEffect(() => {
    if (socketError === undefined) {
      return;
    }
    toast.show(socketError.message, 'error');
    clearSocketError();
  }, [socketError, clearSocketError, toast.show]);

  const buzzEnabled =
    status === 'joined' &&
    canBuzz({
      status: roomState?.status,
      participantId,
      hostId: roomState?.hostId,
      buzzOrder: roomState?.buzzOrder,
    });

  if (tournamentId === undefined) {
    return (
      <main className="app-shell">
        <h1>プレイ</h1>
        <p>大会が見つかりません。</p>
      </main>
    );
  }

  if (displayName === undefined) {
    return (
      <main className="app-shell">
        <h1>プレイ</h1>
        <p>参加するには表示名の入力が必要です。</p>
        <p>
          <Link to={joinPath()}>参加画面へ</Link>
        </p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="app-shell">
        <h1>プレイ</h1>
        <p>{errorMessage ?? '参加に失敗しました'}</p>
        <p>
          <Link to={ROUTE_PATHS.join}>参加画面へ</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="app-shell app-shell--play">
      <h1>プレイ</h1>
      <p>
        {displayName} として参加中 — {status === 'joined' ? '接続中' : '接続しています…'}
      </p>

      <section className="qw-room-section" aria-label="早押し順">
        <h2>早押し順</h2>
        <BuzzOrderList
          buzzOrder={roomState?.buzzOrder ?? []}
          participants={roomState?.participants ?? []}
          currentResponderId={roomState?.currentResponderId}
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

      <div className="qw-buzz-bar">
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
    </main>
  );
}
