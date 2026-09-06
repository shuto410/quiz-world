/**
 * The persistence interface for tournaments.
 *
 * Everything above this line works with tournaments; everything below it works with
 * DynamoDB. The split is what lets the tournament service be tested without a database, and
 * it keeps `Query`, `IndexName` and condition expressions out of the code that reasons about
 * invite codes and host tokens.
 *
 * The methods are the four access patterns listed in `docs/design.md` under `DynamoDB設計`,
 * and deliberately nothing more: no generic `find`, no query builder. A new access pattern
 * has to be added here on purpose, which is the point at which someone asks whether the key
 * design supports it.
 */

import type { TournamentRecord, TournamentStatus } from '@quiz-world/shared';

export type TournamentRepository = {
  /**
   * Writes a new tournament.
   *
   * @throws TournamentIdConflictError if the id is already taken.
   */
  create: (record: TournamentRecord) => Promise<void>;

  findById: (id: string) => Promise<TournamentRecord | undefined>;

  /**
   * The invite code is looked up through a global secondary index, which is eventually
   * consistent. A code generated moments ago may therefore not be visible yet. Callers use
   * this to reduce the chance of a duplicate, never to guarantee uniqueness.
   */
  findByInviteCode: (inviteCode: string) => Promise<TournamentRecord | undefined>;

  /**
   * Marks a tournament closed when it ends, so that the invite code stops admitting people.
   *
   * Only the status and `updatedAt` are written. The rest of the record is settings the host
   * chose at creation and nothing changes them, so a full overwrite would only add a way to
   * lose them.
   *
   * @throws if the tournament does not exist. Ending a tournament that was never stored is a
   * bug, and creating the item here would hide it behind a half-populated record.
   */
  updateStatus: (id: string, status: TournamentStatus, updatedAt: number) => Promise<void>;
};

/**
 * Raised when `create` would overwrite an existing tournament.
 *
 * Ids are UUIDs, so in practice this means a bug rather than bad luck, and the condition
 * that produces it exists so that the bug cannot destroy a live tournament.
 */
export class TournamentIdConflictError extends Error {
  constructor(readonly tournamentId: string) {
    super(`tournament ${tournamentId} already exists`);
    this.name = 'TournamentIdConflictError';
  }
}
