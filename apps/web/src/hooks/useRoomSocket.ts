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
import {
  loadParticipantId,
  saveParticipantId,
  loadParticipantName,
  saveParticipantName,
} from '../storage/sessionKeys';

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
  /** Requests host authority; the broadcast remains the source of truth for the role. */
  claimHost: () => void;
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
  const readyRef = useRef(false);
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
    let terminal = false;
    let generation = 0;
    let acknowledged = false;
    let receivedState = false;
    let claimedId =
      activeRequest.kind === 'participant'
        ? (activeRequest.participantId ?? loadParticipantId(activeRequest.tournamentId))
        : loadParticipantId(activeRequest.tournamentId);
    let displayName =
      activeRequest.kind === 'participant'
        ? activeRequest.displayName
        : loadParticipantName(activeRequest.tournamentId);
    let rejoinAsParticipant = false;
    readyRef.current = false;
    const socket = createSocket();
    socketRef.current = socket;

    setStatus('connecting');
    setRoomState(undefined);
    setParticipantId(undefined);
    setErrorMessage(undefined);
    setSocketError(undefined);
    setRoomClosed(false);

    const updateReady = () => {
      readyRef.current = acknowledged && receivedState && socket.connected && !terminal;
      if (readyRef.current) setStatus('joined');
    };
    const onDisconnect = () => {
      generation += 1;
      acknowledged = false;
      receivedState = false;
      readyRef.current = false;
      if (!cancelled && !terminal) setStatus('connecting');
    };
    const onState = (state: RoomStateEvent) => {
      if (!cancelled && !terminal && socket.connected) {
        const seat = state.participants.find((p) => p.id === claimedId);
        if (seat !== undefined) {
          displayName = seat.name;
          saveParticipantName(activeRequest.tournamentId, seat.name);
        }
        receivedState = true;
        setRoomState(state);
        updateReady();
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
      terminal = true;
      readyRef.current = false;
      setStatus('connecting');
      socket.disconnect();
      if (!cancelled) {
        setRoomClosed(true);
      }
    };

    const onInvalidated = () => {
      terminal = true;
      readyRef.current = false;
      setStatus('error');
      setErrorMessage('別のタブで接続したため、この接続は無効になりました');
      socket.disconnect();
    };
    const onConnectError = () => {
      onDisconnect();
      if (!cancelled && !terminal) setErrorMessage('サーバーに再接続しています…');
    };
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('session:invalidated', onInvalidated);
    socket.on('room:state', onState);
    socket.on('error', onError);
    socket.on('room:closed', onClosed);

    const join = () => {
      if (cancelled || terminal) return;
      const attempt = ++generation;
      acknowledged = false;
      receivedState = false;
      readyRef.current = false;
      setStatus('connecting');
      setErrorMessage(undefined);
      const finishJoin = (response: JoinResponse) => {
        if (cancelled || terminal || attempt !== generation || !socket.connected) return;
        if (
          !response.ok &&
          response.code === 'UNAUTHORIZED' &&
          activeRequest.kind === 'host' &&
          !rejoinAsParticipant &&
          claimedId !== undefined &&
          displayName !== undefined
        ) {
          rejoinAsParticipant = true;
          joinParticipant();
          return;
        }
        if (!response.ok) {
          terminal = true;
          setStatus('error');
          setErrorMessage(response.message);
          socket.disconnect();
          return;
        }
        claimedId = response.participantId;
        saveParticipantId(activeRequest.tournamentId, response.participantId);
        setParticipantId(response.participantId);
        acknowledged = true;
        updateReady();
      };
      const joinParticipant = () => {
        socket.emit(
          'tournament:join',
          {
            tournamentId: activeRequest.tournamentId,
            displayName: displayName ?? '',
            ...(claimedId === undefined ? {} : { participantId: claimedId }),
          },
          finishJoin,
        );
      };
      if (activeRequest.kind === 'host' && !rejoinAsParticipant) {
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
      joinParticipant();
    };

    socket.on('connect', join);
    socket.connect();

    return () => {
      cancelled = true;
      readyRef.current = false;
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('session:invalidated', onInvalidated);
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
    if (!readyRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit('tournament:leave', {});
    readyRef.current = false;
    socketRef.current.disconnect();
    setStatus('error');
    setErrorMessage('退出しました');
  }, []);

  const buzz = useCallback(() => {
    if (!readyRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit('game:buzz', {});
  }, []);

  const submitAnswer = useCallback((answerText: string) => {
    if (!readyRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit('answer:submit', { answerText });
  }, []);

  const judge = useCallback((judgement: JudgeSubmitPayload) => {
    if (!readyRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit('judge:submit', judgement);
  }, []);

  const resetGame = useCallback(() => {
    if (!readyRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit('game:reset', {});
  }, []);

  const finishTournament = useCallback(() => {
    if (!readyRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit('tournament:finish', {});
  }, []);

  const closeRoom = useCallback(() => {
    if (!readyRef.current || !socketRef.current?.connected) return;
    socketRef.current.emit('room:close', {});
  }, []);

  const claimHost = useCallback(() => {
    const socket = socketRef.current;
    if (!readyRef.current || socket === undefined || !socket.connected) return;
    socket.emit('host:claim', {}, (response) => {
      if (socketRef.current !== socket || !socket.connected) return;
      if (!response.ok) setSocketError({ code: response.code, message: response.message });
    });
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
    claimHost,
  };
}
