/**
 * Connects to a room, performs host or participant join, and keeps the latest `room:state`.
 *
 * One socket per mount. The screen decides which join event to fire; this hook owns connect,
 * ack handling, localStorage of the issued participant id, and teardown on unmount.
 *
 * Gameplay emits such as `game:buzz` go through here so screens never hold a raw socket.
 * Refused operations surface on `socketError` for the caller to toast; accepted ones arrive
 * only as a fresh `room:state`.
 *
 * The join request is compared by a stable key rather than object identity, so a parent that
 * rebuilds the request object each render does not tear down the socket.
 */

import type {
  JoinResponse,
  JudgeSubmitPayload,
  RoomStateEvent,
  SocketErrorEvent,
} from '@quiz-world/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Latest gameplay error from the server; cleared when the caller acknowledges it. */
  socketError: SocketErrorEvent | undefined;
  clearSocketError: () => void;
  leave: () => void;
  buzz: () => void;
  /** Text is validated here as well, but the server's answer is the binding one. */
  submitAnswer: (answerText: string) => void;
  /** Host only. The participant id names who is being judged, not the sender. */
  judge: (judgement: JudgeSubmitPayload) => void;
  /** Host only. Closes the result screen and reopens buzzing. */
  resetGame: () => void;
  /** Host only. Ends the tournament and moves everyone to the final result. */
  finishTournament: () => void;
  /** Host only. Closes the room, which disconnects everyone including the caller. */
  closeRoom: () => void;
  /** True once the host has closed the room. The socket stays down from then on. */
  roomClosed: boolean;
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
  const [socketError, setSocketError] = useState<SocketErrorEvent | undefined>(undefined);
  const [roomClosed, setRoomClosed] = useState(false);
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
    setSocketError(undefined);
    setRoomClosed(false);

    const onState = (state: RoomStateEvent) => {
      if (!cancelled) {
        setRoomState(state);
      }
    };

    const onError = (event: SocketErrorEvent) => {
      if (!cancelled) {
        setSocketError(event);
      }
    };

    /**
     * The server disconnects right after this. Reconnection is disabled here rather than left
     * to retry forever against a room that no longer exists.
     */
    const onClosed = () => {
      socket.disconnect();
      if (!cancelled) {
        setRoomClosed(true);
      }
    };

    socket.on('room:state', onState);
    socket.on('error', onError);
    socket.on('room:closed', onClosed);

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
      socket.off('error', onError);
      socket.off('room:closed', onClosed);
      socket.disconnect();
      socketRef.current = undefined;
    };
  }, [key]);

  const clearSocketError = useCallback(() => {
    setSocketError(undefined);
  }, []);

  const leave = useCallback(() => {
    socketRef.current?.emit('tournament:leave', {});
  }, []);

  const buzz = useCallback(() => {
    socketRef.current?.emit('game:buzz', {});
  }, []);

  const submitAnswer = useCallback((answerText: string) => {
    socketRef.current?.emit('answer:submit', { answerText });
  }, []);

  const judge = useCallback((judgement: JudgeSubmitPayload) => {
    socketRef.current?.emit('judge:submit', judgement);
  }, []);

  const resetGame = useCallback(() => {
    socketRef.current?.emit('game:reset', {});
  }, []);

  const finishTournament = useCallback(() => {
    socketRef.current?.emit('tournament:finish', {});
  }, []);

  const closeRoom = useCallback(() => {
    socketRef.current?.emit('room:close', {});
  }, []);

  return {
    status,
    roomState,
    participantId,
    errorMessage,
    socketError,
    clearSocketError,
    leave,
    buzz,
    submitAnswer,
    judge,
    resetGame,
    finishTournament,
    closeRoom,
    roomClosed,
  };
}
