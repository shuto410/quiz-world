/**
 * Per-connection identity bound after a successful join.
 *
 * After join, every gameplay event resolves the actor from this session rather than from the
 * client payload. That is the mechanical enforcement of "never trust a participantId the
 * browser sends": the only time a client-supplied id is considered is the optional claim on
 * `tournament:join`, and even then it is verified against the room before being stored here.
 */

import type { ParticipantRole } from '@quiz-world/shared';

/** Fields attached to `socket.data` for the life of a joined connection. */
export type SocketSession = {
  tournamentId: string;
  participantId: string;
  role: ParticipantRole;
};

/** Narrows `socket.data` once a join has succeeded. */
export function readSession(data: unknown): SocketSession | undefined {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('tournamentId' in data) ||
    !('participantId' in data) ||
    !('role' in data)
  ) {
    return undefined;
  }

  const { tournamentId, participantId, role } = data as Record<string, unknown>;

  if (
    typeof tournamentId !== 'string' ||
    typeof participantId !== 'string' ||
    (role !== 'host' && role !== 'participant')
  ) {
    return undefined;
  }

  return { tournamentId, participantId, role };
}

/** Writes the session after an accepted join. */
export function bindSession(data: Record<string, unknown>, session: SocketSession): void {
  data['tournamentId'] = session.tournamentId;
  data['participantId'] = session.participantId;
  data['role'] = session.role;
}

/** Clears the session on leave so a later event cannot act as the previous seat. */
export function clearSession(data: Record<string, unknown>): void {
  delete data['tournamentId'];
  delete data['participantId'];
  delete data['role'];
}
