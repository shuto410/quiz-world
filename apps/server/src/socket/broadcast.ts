/**
 * The single path by which room state, and the one cue that is not state, reach clients.
 *
 * Two things have to be true every time state is sent, and both are easy to forget at an
 * individual call site: participants must receive the converted view rather than the
 * authoritative one, and everyone in the room must be updated together so that no client is
 * left rendering a state the others have moved on from.
 *
 * Centralising it here makes both automatic. A lint rule rejects `emit('room:state', ...)`
 * anywhere else in the server, so this is the only place that can send it.
 *
 * The host/participant split is carried by two Socket.io rooms rather than by looking up who
 * the host is at send time. A connection joins the channel matching its role once, and
 * broadcasting is then a property of the channel it sits in.
 *
 * The judgement cue goes through here for the second of those reasons only: it has nothing to
 * hide from anyone, but it has to reach both channels or half the room sits in silence.
 */

import type { ClientToServerEvents, ServerToClientEvents } from '@quiz-world/shared';
import type { Server } from 'socket.io';
import { toParticipantRoomState } from '../domain/roomState';
import type { RoomHandle } from '../rooms/roomRegistry';

/** The Socket.io server, typed with the shared event contract. */
export type SocketServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** Channel holding the single connection that currently has host authority. */
export function hostChannel(tournamentId: string): string {
  return `tournament:${tournamentId}:host`;
}

/** Channel holding every participant connection. */
export function participantChannel(tournamentId: string): string {
  return `tournament:${tournamentId}:participants`;
}

/** Sends the current state of a room to everyone connected to it. */
export function broadcastRoomState(io: SocketServer, handle: RoomHandle): void {
  const state = handle.read();

  io.to(hostChannel(handle.tournamentId)).emit('room:state', state);
  io.to(participantChannel(handle.tournamentId)).emit('room:state', toParticipantRoomState(state));
}

/** Tells everyone in a room to play the correct or wrong cue once. Carries no state. */
export function broadcastJudgementEffect(
  io: SocketServer,
  tournamentId: string,
  isCorrect: boolean,
): void {
  io.to(hostChannel(tournamentId)).emit('effect:judgement', { isCorrect });
  io.to(participantChannel(tournamentId)).emit('effect:judgement', { isCorrect });
}
