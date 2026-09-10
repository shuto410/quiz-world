/**
 * Participant play screen: join with a display name, watch the roster, and press the buzzer.
 *
 * The buzzer and the answer field share the central gameplay area, both always
 * present so the layout does not move between rounds. Whether either is enabled is derived
 * from the broadcast state (`canBuzz`, `canSubmitAnswer`) so a disabled control matches what
 * the server would refuse. A sent answer is not echoed back: participants are not shown an
 * unjudged answer, not even their own.
 *
 * The judgement section appears only while the room is showing a result, which is also the
 * only time the server includes the answer text in a participant's state. Both come straight
 * from that state, so this screen never decides what may be revealed.
 */

import { useEffect, useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { HostRoomView } from '../components/HostRoomView';
import { ParticipantRoomView } from '../components/ParticipantRoomView';
import { useToast } from '../components/Toast';
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

  const connection = useRoomSocket(joinRequest);
  const { status, roomState, participantId, errorMessage, socketError, clearSocketError } =
    connection;

  useEffect(() => {
    if (socketError === undefined) {
      return;
    }
    toast.show(socketError.message, 'error');
    clearSocketError();
  }, [socketError, clearSocketError, toast.show]);

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

  if (
    roomState !== undefined &&
    participantId !== undefined &&
    roomState.hostId === participantId
  ) {
    return <HostRoomView connection={connection} />;
  }
  return <ParticipantRoomView connection={connection} displayName={displayName} />;
}
