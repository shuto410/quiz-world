/**
 * Host room screen: join with the stored token, watch the roster, follow the buzz order and
 * read the answer that is waiting to be judged.
 *
 * The submitted answer is on this screen and nowhere else until the judgement is shown. That
 * is not enforced here: the server strips the field from the participants' copy of the
 * state, so this screen simply renders what only it receives.
 *
 * The progression area shows one thing at a time, chosen by the room status, so that the
 * only controls on screen are the ones the server would currently accept. The two actions
 * that cannot be undone — ending the tournament and closing the room — ask first.
 */

import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HostRoomView } from '../components/HostRoomView';
import { ParticipantRoomView } from '../components/ParticipantRoomView';
import { useToast } from '../components/Toast';
import { useRoomSocket } from '../hooks/useRoomSocket';
import { ROUTE_PATHS } from '../routes';
import { loadHostToken, loadInviteDetails } from '../storage/sessionKeys';

export function HostPage() {
  const { tournamentId } = useParams();
  const toast = useToast();
  const hostToken = tournamentId === undefined ? undefined : loadHostToken(tournamentId);
  const inviteDetails = tournamentId === undefined ? undefined : loadInviteDetails(tournamentId);

  const joinRequest = useMemo(() => {
    if (tournamentId === undefined || hostToken === undefined) {
      return undefined;
    }
    return { kind: 'host' as const, tournamentId, hostToken };
  }, [tournamentId, hostToken]);

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

  if (
    roomState !== undefined &&
    participantId !== undefined &&
    roomState.hostId !== participantId
  ) {
    return (
      <ParticipantRoomView
        connection={connection}
        displayName={roomState.participants.find((p) => p.id === participantId)?.name ?? '参加者'}
      />
    );
  }
  return <HostRoomView connection={connection} inviteDetails={inviteDetails} />;
}
