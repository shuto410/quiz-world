/**
 * The HTTP contract of the Express side of the socket server.
 *
 * Only the two things that have to happen before a socket connection exists are served over
 * HTTP: creating a tournament, and turning an invite code into something the join screen can
 * show. Everything during play goes over the socket.
 */

import type { Tournament, TournamentStatus } from './tournament';

/** Body of `POST /api/tournaments`. Validated again on the server even though the client checks it. */
export type CreateTournamentRequest = {
  name: string;
  maxParticipants: number;
};

/**
 * Response of `POST /api/tournaments`.
 *
 * The only time the host token is ever transmitted. It is stored hashed, so if the host
 * loses it the token cannot be reissued and the room has to be recovered through the host
 * takeover flow instead.
 */
export type CreateTournamentResponse = {
  tournament: Tournament;
  /** Built from configuration rather than a hard-coded host name, so the domain can change. */
  inviteUrl: string;
  hostToken: string;
};

/**
 * Response of `GET /api/tournaments/by-invite-code/:code`.
 *
 * Public information only: enough to show "you are about to join <name>" to someone holding
 * an invite code, and nothing about who is already inside.
 */
export type ResolveInviteCodeResponse = {
  tournamentId: string;
  name: string;
  status: TournamentStatus;
  /**
   * Derived from the status alone. Capacity is not considered here because it changes by the
   * second; the binding check happens when the participant actually joins.
   */
  canJoin: boolean;
};

/** Every error code an HTTP endpoint can return. */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'TOURNAMENT_NOT_FOUND',
  'TOURNAMENT_NOT_JOINABLE',
  'INTERNAL_ERROR',
] as const;

/** Why an HTTP request was rejected. */
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Body returned with every non-2xx response. */
export type ApiErrorResponse = {
  code: ApiErrorCode;
  message: string;
};
