/**
 * An in-memory `TournamentRepository` for testing the layers above it.
 *
 * It exists so that the tournament service can be tested for its own behaviour — validation,
 * invite code retries, what ends up in the response — without a database in the way. The
 * DynamoDB implementation is verified separately, against a real DynamoDB, in
 * `dynamoRepository.test.ts`.
 *
 * It reproduces the two behaviours the callers depend on: the id conflict, and the
 * case-insensitive invite code lookup. It does not reproduce the index's eventual
 * consistency, because no caller may rely on the outcome of a lookup being authoritative.
 */

import type { TournamentRecord } from '@quiz-world/shared';
import { normalizeInviteCode } from '@quiz-world/shared';
import { type TournamentRepository, TournamentIdConflictError } from '../tournaments/repository';

export type InMemoryTournamentRepository = TournamentRepository & {
  /** Everything written so far, for asserting on what was persisted. */
  stored: () => TournamentRecord[];
};

export function createInMemoryTournamentRepository(
  seed: readonly TournamentRecord[] = [],
): InMemoryTournamentRepository {
  const records = new Map<string, TournamentRecord>(seed.map((record) => [record.id, record]));

  return {
    create: (record) => {
      if (records.has(record.id)) {
        return Promise.reject(new TournamentIdConflictError(record.id));
      }
      records.set(record.id, record);
      return Promise.resolve();
    },

    findById: (id) => Promise.resolve(records.get(id)),

    findByInviteCode: (inviteCode) => {
      const wanted = normalizeInviteCode(inviteCode);
      return Promise.resolve([...records.values()].find((record) => record.inviteCode === wanted));
    },

    stored: () => [...records.values()],
  };
}
