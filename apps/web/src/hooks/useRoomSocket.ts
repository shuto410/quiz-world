/**
 * Connects to a room, performs host or participant join, and keeps the latest `room:state`.
 *
 * One socket per mount. The screen decides which join event to fire; this hook owns connect,
 * ack handling, localStorage of the issued participant id, and teardown on unmount.
 *
 * The join request is compared by a stable key rather than object identity, so a parent that
 * rebuilds the request object each render does not tear down the socket.
 */

import type { JoinResponse, RoomStateEvent } from '@quiz-world/shared';
import { useEffect, useRef, useState } from 'react';
import { createSocket, type AppSocket } from '../socket/client';
import { saveParticipantId } from '../storage/sessionKeys';

export type RoomJoinRequest =
  | { kind: 'host'; tournamentId: string; hostToken: string }
  | {
      kind: 'participant';
      tournamentId: string;
      displayName: string;
      participantId?: string;
    };

export type RoomSocketStatus = 'connecting' | 'joined' | 'error';

export type UseRoomSocketResult = {
  status: RoomSocketStatus;
  roomState: RoomStateEvent | undefined;
  participantId: string | undefined;
  errorMessage: string | undefined;
  leave: () => void;
};

function requestKey(request: RoomJoinRequest | undefined): string {
  if (request === undefined) {
    return '';
  }
  if (request.kind === 'host') {
    return `host:${request.tournamentId}:${request.hostToken}`;
  }
  return `participant:${request.tournamentId}:${request.displayName}:${request.participantId ?? ''}`;
}

export function useRoomSocket(request: RoomJoinRequest | undefined): UseRoomSocketResult {
  const [status, setStatus] = useState<RoomSocketStatus>('connecting');
  const [roomState, setRoomState] = useState<RoomStateEvent | undefined>(undefined);
  const [participantId, setParticipantId] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const socketRef = useRef<AppSocket | undefined>(undefined);
  const requestRef = useRef(request);
  requestRef.current = request;
  const key = requestKey(request);

  useEffect(() => {
    const activeRequest = requestRef.current;
    if (activeRequest === undefined || key === '') {
      return;
    }

    let cancelled = false;
    const socket = createSocket();
    socketRef.current = socket;

    setStatus('connecting');
    setRoomState(undefined);
    setParticipantId(undefined);
    setErrorMessage(undefined);

    const onState = (state: RoomStateEvent) => {
      if (!cancelled) {
        setRoomState(state);
      }
    };

    socket.on('room:state', onState);

    const finishJoin = (response: JoinResponse) => {
      if (cancelled) {
        return;
      }
      if (!response.ok) {
        setStatus('error');
        setErrorMessage(response.message);
        return;
      }
      saveParticipantId(activeRequest.tournamentId, response.participantId);
      setParticipantId(response.participantId);
      setStatus('joined');
    };

    const join = () => {
      if (activeRequest.kind === 'host') {
        socket.emit(
          'tournament:host-join',
          {
            tournamentId: activeRequest.tournamentId,
            hostToken: activeRequest.hostToken,
          },
          finishJoin,
        );
        return;
      }
      socket.emit(
        'tournament:join',
        {
          tournamentId: activeRequest.tournamentId,
          displayName: activeRequest.displayName,
          ...(activeRequest.participantId === undefined
            ? {}
            : { participantId: activeRequest.participantId }),
        },
        finishJoin,
      );
    };

    socket.connect();

    if (socket.connected) {
      join();
    } else {
      socket.once('connect', join);
    }

    socket.once('connect_error', () => {
      if (!cancelled) {
        setStatus('error');
        setErrorMessage('サーバーに接続できませんでした');
      }
    });

    return () => {
      cancelled = true;
      socket.off('room:state', onState);
      socket.disconnect();
      socketRef.current = undefined;
    };
  }, [key]);

  return {
    status,
    roomState,
    participantId,
    errorMessage,
    leave: () => {
      socketRef.current?.emit('tournament:leave', {});
    },
  };
}
