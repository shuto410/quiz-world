/**
 * The socket contract between the web client and the socket server.
 *
 * One event per operation, and one way to synchronise: after every accepted change the
 * server broadcasts the whole room state on `room:state`. There are no incremental patch
 * events, because reconciling patches on the client is exactly the kind of duplicated game
 * logic this design avoids.
 *
 * Two rules shape the payloads below:
 *
 * - No payload carries a `participantId` identifying the sender. The server resolves the
 *   actor from the socket session, so a client cannot act on someone else's behalf. The
 *   `participantId` in `TournamentJoinPayload` is the exception that proves the rule: at
 *   join time there is no session yet, and it is a claim to be verified, not an identity.
 * - No payload carries a score, a rank or a timestamp produced by the client. The server
 *   stamps its own receive time, because buzz order depends on it.
 *
 * This module intentionally has no dependency on `socket.io`: the event maps are plain
 * types, so the same definitions type both the server and the browser client.
 */

import type { HostRoomState, JudgeNextAction, ParticipantRoomState } from './game';

/** Which side of the room a connection is on. */
export type ParticipantRole = 'host' | 'participant';

/** Every error code an operation can be rejected with. */
export const SOCKET_ERROR_CODES = [
  /** Host token did not match the stored hash. */
  'UNAUTHORIZED',
  /** Payload failed validation. */
  'VALIDATION_ERROR',
  'TOURNAMENT_NOT_FOUND',
  /** The tournament is closed, so nobody new can join. */
  'TOURNAMENT_NOT_JOINABLE',
  'TOURNAMENT_FULL',
  'DUPLICATE_DISPLAY_NAME',
  /** A host-only operation was attempted by a participant. */
  'NOT_HOST',
  /** An answer was submitted by someone who does not hold the answer right. */
  'NOT_CURRENT_RESPONDER',
  /** The operation is not allowed while the room is in its current status. */
  'INVALID_STATE',
  /** `moveToNextResponder` was requested but nobody is left in the buzz queue. */
  'NO_NEXT_RESPONDER',
  /** The operation came from a connection that a newer one has replaced. */
  'STALE_CONNECTION',
  /** The socket exceeded the configured per-event request budget. */
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

/** Why an operation was rejected. Shared by acknowledgements and the `error` event. */
export type SocketErrorCode = (typeof SOCKET_ERROR_CODES)[number];

/**
 * Host connects to a room using the token issued when the tournament was created.
 *
 * Allowed for both `active` and `closed` tournaments, so that the host can reopen the final
 * result after ending the tournament.
 */
export type TournamentHostJoinPayload = {
  tournamentId: string;
  hostToken: string;
};

/**
 * Participant joins as a guest. No account, just a display name.
 *
 * `participantId` is sent when the browser has one stored from an earlier visit. The server
 * treats it as a claim: if it matches an existing participant, that seat is resumed with
 * its score intact, otherwise a fresh id is issued.
 */
export type TournamentJoinPayload = {
  tournamentId: string;
  displayName: string;
  participantId?: string;
};

/** Participant leaves deliberately. Their entry and score stay in the room. */
export type TournamentLeavePayload = Record<string, never>;

/** Participant changes their display name. Allowed at any point in the tournament. */
export type ParticipantRenamePayload = {
  displayName: string;
};

/**
 * An online participant takes over host authority.
 *
 * Only accepted while the room is paused because the host disconnected, and only the first
 * request the server receives wins.
 */
export type HostClaimPayload = Record<string, never>;

/**
 * Participant presses the buzzer.
 *
 * Carries nothing at all: the actor comes from the session and the ordering comes from the
 * server's receive order, so there is nothing for the client to send.
 */
export type BuzzPayload = Record<string, never>;

/** The current responder sends a written answer. */
export type AnswerSubmitPayload = {
  answerText: string;
};

/**
 * Host judges the current answer.
 *
 * Correctness, score change and what happens next are decided in one operation so that the
 * room never rests between a judgement and its follow-up. `participantId` here identifies
 * the person being judged, not the sender.
 */
export type JudgeSubmitPayload = {
  participantId: string;
  isCorrect: boolean;
  /** Added to the participant's score. May be negative or zero. */
  scoreDelta: number;
  nextAction: JudgeNextAction;
};

/**
 * Host closes the result screen and reopens buzzing.
 *
 * Separate from `judge:submit` on purpose. Judging always applies a score change, so reusing
 * it to leave the result screen would create a path that awards the same points twice.
 */
export type GameResetPayload = Record<string, never>;

/** Host ends the tournament and moves everyone to the final result screen. */
export type TournamentFinishPayload = Record<string, never>;

/** Host closes the room for good. */
export type RoomClosePayload = Record<string, never>;

/**
 * Full room state after every accepted change.
 *
 * Which of the two shapes a client receives depends on its role. They are structurally
 * alike, so the guarantee that participants never see an unjudged answer rests on the
 * server-side conversion function and its tests, not on this union.
 */
export type RoomStateEvent = HostRoomState | ParticipantRoomState;

/** The host closed the room. Clients should stop reconnecting after this. */
export type RoomClosedEvent = {
  reason: 'hostClosed';
};

/**
 * A newer connection took over this participant id, so this one is now stale.
 *
 * Sent to the older connection when someone opens the room in a second tab or reconnects
 * before the previous socket timed out.
 */
export type SessionInvalidatedEvent = Record<string, never>;

/**
 * An operation was rejected.
 *
 * The server follows this with a fresh `room:state` when the client is an existing member,
 * so that a client which acted on a stale view is pulled back in sync.
 */
export type SocketErrorEvent = {
  code: SocketErrorCode;
  message: string;
};

/**
 * Failure shape shared by every acknowledged event.
 *
 * A failed acknowledgement deliberately carries no room state: someone who was refused
 * entry must not learn the participant names or scores inside.
 */
export type AckFailure = {
  ok: false;
  code: SocketErrorCode;
  message: string;
};

/** Successful join or host handshake. */
export type JoinSuccess = {
  ok: true;
  role: ParticipantRole;
  /** The id the client should store; either the one it claimed or a newly issued one. */
  participantId: string;
  /** True when an existing seat was resumed rather than a new one created. */
  isReconnect: boolean;
};

export type JoinResponse = JoinSuccess | AckFailure;

/** Successful rename, echoing the normalised name the server actually stored. */
export type RenameSuccess = {
  ok: true;
  displayName: string;
};

export type RenameResponse = RenameSuccess | AckFailure;

/** Successful host takeover. `hostId` is the new host, which is always the caller. */
export type HostClaimSuccess = {
  ok: true;
  hostId: string;
};

export type HostClaimResponse = HostClaimSuccess | AckFailure;

/**
 * Events the client sends.
 *
 * Only joining and authority changes are acknowledged, because the caller needs an
 * immediate answer to decide what screen to show. Gameplay events are not: their outcome is
 * the broadcast state, and adding an acknowledgement would invite clients to act on a local
 * prediction instead of on the server's version of events.
 */
export type ClientToServerEvents = {
  'tournament:host-join': (
    payload: TournamentHostJoinPayload,
    ack: (response: JoinResponse) => void,
  ) => void;
  'tournament:join': (
    payload: TournamentJoinPayload,
    ack: (response: JoinResponse) => void,
  ) => void;
  'tournament:leave': (payload: TournamentLeavePayload) => void;
  'participant:rename': (
    payload: ParticipantRenamePayload,
    ack: (response: RenameResponse) => void,
  ) => void;
  'host:claim': (payload: HostClaimPayload, ack: (response: HostClaimResponse) => void) => void;
  'game:buzz': (payload: BuzzPayload) => void;
  'answer:submit': (payload: AnswerSubmitPayload) => void;
  'judge:submit': (payload: JudgeSubmitPayload) => void;
  'game:reset': (payload: GameResetPayload) => void;
  'tournament:finish': (payload: TournamentFinishPayload) => void;
  'room:close': (payload: RoomClosePayload) => void;
};

/** Events the server sends. */
export type ServerToClientEvents = {
  'room:state': (state: RoomStateEvent) => void;
  'room:closed': (event: RoomClosedEvent) => void;
  'session:invalidated': (event: SessionInvalidatedEvent) => void;
  error: (event: SocketErrorEvent) => void;
};

/**
 * Every client-to-server event name.
 *
 * Kept as a value so that tests can walk the whole event surface, in particular the
 * status-by-event table that pins down which operations each game status accepts.
 */
export const CLIENT_TO_SERVER_EVENT_NAMES = [
  'tournament:host-join',
  'tournament:join',
  'tournament:leave',
  'participant:rename',
  'host:claim',
  'game:buzz',
  'answer:submit',
  'judge:submit',
  'game:reset',
  'tournament:finish',
  'room:close',
] as const satisfies readonly (keyof ClientToServerEvents)[];

/** Every server-to-client event name. */
export const SERVER_TO_CLIENT_EVENT_NAMES = [
  'room:state',
  'room:closed',
  'session:invalidated',
  'error',
] as const satisfies readonly (keyof ServerToClientEvents)[];

/** Names of the events the client can send. */
export type ClientToServerEventName = (typeof CLIENT_TO_SERVER_EVENT_NAMES)[number];

/** Names of the events the server can send. */
export type ServerToClientEventName = (typeof SERVER_TO_CLIENT_EVENT_NAMES)[number];
