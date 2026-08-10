/**
 * The single path by which room state reaches clients.
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
