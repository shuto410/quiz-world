/**
 * Core game domain model of a quiz tournament room.
 *
 * The socket server owns one `InternalRoomState` per room and treats it as the single
 * source of truth for buzz order, answer rights and scores. Clients never compute any of
 * these; they only render what the server broadcasts.
 *
 * Values a client can derive from the fields below are deliberately absent: rankings, the
 * winner, "am I the host", "have I already buzzed" and so on. `ROOM_STATE_KEYS` and
 * `PARTICIPANT_STATE_KEYS` freeze the field lists, and the accompanying tests fail as soon
 * as a derived value is introduced.
 *
 * Every timestamp is Unix epoch milliseconds measured on the server. Client clocks are
 * never trusted, because buzz order has to be decided by server receive order.
 */

/** Every progress state a room can be in. Listed so that tests can enumerate them. */
export const GAME_STATUSES = ['idle', 'answering', 'result', 'paused', 'finished'] as const;

/**
 * Progress state of a tournament room, owned by the socket server and broadcast to all
 * clients after each accepted change.
 *
 * - `idle`: nobody holds the answer right, participants may buzz.
 * - `answering`: a responder holds the answer right. Others may still buzz to queue up.
 * - `result`: the judgement of the last answer is being shown.
 * - `paused`: suspended, in practice because the host disconnected.
 * - `finished`: the tournament ended and only the final result is shown.
 */
export type GameStatus = (typeof GAME_STATUSES)[number];

/** Every reason a room can be paused for. */
export const PAUSED_REASONS = ['hostDisconnected'] as const;

/**
 * Why the room was paused. Pausing is always automatic; there is no manual pause in the
 * MVP, so a disconnected host is currently the only reason.
 */
export type PausedReason = (typeof PAUSED_REASONS)[number];

/** Every follow-up action the host can pick when submitting a judgement. */
export const JUDGE_NEXT_ACTIONS = ['showResult', 'resetToIdle', 'moveToNextResponder'] as const;

/**
 * What happens to the room right after the host judges an answer. The host picks the
 * judgement, the score delta and the follow-up action in a single operation, so that the
 * room never sits in a half-judged state.
 *
 * - `showResult`: keep the judgement on screen and move to `result`.
 * - `resetToIdle`: discard the judgement and reopen buzzing.
 * - `moveToNextResponder`: pass the answer right to the next entry in `buzzOrder`.
 */
export type JudgeNextAction = (typeof JUDGE_NEXT_ACTIONS)[number];

/**
 * A person taking part in the tournament.
 *
 * Participants who left keep their entry so that their score and display name stay visible
 * for the rest of the tournament; they are marked with `online: false` rather than removed.
 */
export type ParticipantState = {
  /** Server-issued UUID. Stored in the browser so that a reconnect resumes the same seat. */
  id: string;
  /** Trimmed display name, unique within the room. */
  name: string;
  /** Whether a live socket connection currently backs this participant. */
  online: boolean;
  /** When the participant first joined. Latecomers start from a score of 0. */
  joinedAt: number;
  /** Running total. Can go negative, because a wrong answer may cost points. */
  score: number;
};

/**
 * One round of buzz handling, opened by the first accepted buzz and closed by the host's
 * judgement. It exists so that repeated buzzes from the same participant can be rejected
 * within a round, and so that a late judgement cannot be applied to a newer round.
 */
export type BuzzSessionState = {
  /** Server-issued UUID identifying this round. */
  id: string;
  startedAt: number;
};

/**
 * A single accepted buzz. The rank is the index in `buzzOrder`, not a stored field, and the
 * order is the order the server received the buzzes in.
 */
export type BuzzEntry = {
  participantId: string;
  receivedAt: number;
};

/**
 * The latest text answer sent by the current responder.
 *
 * Visible to the host immediately, but withheld from participants until the judgement is
 * shown, so that nobody can read the answer before it is judged.
 */
export type SubmittedAnswerState = {
  participantId: string;
  answerText: string;
  receivedAt: number;
};

/**
 * The judgement being shown on the result screen. Only the last one is kept; there is no
 * answer history, because the MVP does not persist tournament records.
 */
export type LastResultState = {
  participantId: string;
  isCorrect: boolean;
  /** Points added to the participant's score. Negative when the host deducts points. */
  scoreDelta: number;
};

/**
 * Authoritative in-memory room state owned by the socket server.
 *
 * This is the type every state transition reads and writes. It is snapshotted to DynamoDB
 * for crash recovery, and converted before being sent to participants.
 */
export type InternalRoomState = {
  tournamentId: string;
  status: GameStatus;
  /** Status to restore when the pause ends. Only set while `status` is `paused`. */
  statusBeforePause?: GameStatus;
  /** Only set while `status` is `paused`. */
  pausedReason?: PausedReason;
  /**
   * Participant id currently holding host authority. It changes when a participant takes
   * over a disconnected host, so it is not necessarily the person who created the room.
   */
  hostId: string;
  /** Original host seat authenticated by the creation token; preserved across takeovers. */
  initialHostId?: string;
  hostOnline: boolean;
  participants: ParticipantState[];
  /** Set while a buzz round is open, from the first buzz until the judgement. */
  currentBuzzSession?: BuzzSessionState;
  /** Accepted buzzes of the current round, in server receive order. The index is the rank. */
  buzzOrder: BuzzEntry[];
  /** Who currently holds the answer right. Unset while `status` is `idle`. */
  currentResponderId?: string;
  currentSubmittedAnswer?: SubmittedAnswerState;
  lastResult?: LastResultState;
  updatedAt: number;
};

/**
 * State sent to the host. The host is allowed to see everything, including an answer that
 * has not been judged yet, because judging is exactly what the host is there to do.
 */
export type HostRoomState = InternalRoomState;

/**
 * State sent to participants.
 *
 * Structurally the same as the host view, but `currentSubmittedAnswer` is stripped unless
 * the judgement is being shown. Participants must only ever receive the output of the
 * conversion function, never a raw `InternalRoomState`.
 */
export type ParticipantRoomState = Omit<InternalRoomState, 'currentSubmittedAnswer'> & {
  currentSubmittedAnswer?: SubmittedAnswerState;
};

/**
 * The complete field list of `InternalRoomState`.
 *
 * This constant exists to make adding a field a deliberate act. `satisfies` rejects names
 * that are not part of the type, and the test suite rejects fields of the type that are
 * missing here, so a derived value cannot slip in unnoticed during review.
 */
export const ROOM_STATE_KEYS = [
  'tournamentId',
  'status',
  'statusBeforePause',
  'pausedReason',
  'hostId',
  'initialHostId',
  'hostOnline',
  'participants',
  'currentBuzzSession',
  'buzzOrder',
  'currentResponderId',
  'currentSubmittedAnswer',
  'lastResult',
  'updatedAt',
] as const satisfies readonly (keyof InternalRoomState)[];

/**
 * The complete field list of `ParticipantState`.
 *
 * Guarded for the same reason as `ROOM_STATE_KEYS`. Per-participant flags such as `isHost`
 * or `hasBuzzed` are the most tempting derived values to add, so they are frozen out here.
 */
export const PARTICIPANT_STATE_KEYS = [
  'id',
  'name',
  'online',
  'joinedAt',
  'score',
] as const satisfies readonly (keyof ParticipantState)[];
