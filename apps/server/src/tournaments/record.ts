/**
 * Conversion between the stored tournament and the published one.
 *
 * Two directions, each guarding a different mistake.
 *
 * `toTournament` is the only way a tournament reaches a client. It builds its result field by
 * field instead of deleting the secret ones, so a field added to `TournamentRecord` later
 * stays on the server unless someone deliberately publishes it.
 *
 * `parseTournamentRecord` re-validates what comes back out of DynamoDB. The table is
 * schemaless and outlives any single deployment, so an item can have been written by an older
 * version of this code. Checking on read means a wrong shape surfaces here, with the id of the
 * offending row, rather than as an undefined field somewhere deep in a socket handler.
 */

import type { Tournament, TournamentRecord } from '@quiz-world/shared';
import { TOURNAMENT_STATUSES } from '@quiz-world/shared';
import { isRecord } from '../guards';

/** Strips the host token hash and the reserved account id. */
export function toTournament(record: TournamentRecord): Tournament {
  return {
    id: record.id,
    name: record.name,
    maxParticipants: record.maxParticipants,
    inviteCode: record.inviteCode,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** Thrown when a stored item does not match `TournamentRecord`. */
export class CorruptTournamentRecordError extends Error {
  constructor(fields: readonly string[]) {
    // The field names are safe to log; the values are not, since one of them is a token hash.
    super(`stored tournament has invalid fields: ${fields.join(', ')}`);
    this.name = 'CorruptTournamentRecordError';
  }
}

/**
 * Validates one item read from the table.
 *
 * @throws CorruptTournamentRecordError when a field is missing or has the wrong type.
 */
export function parseTournamentRecord(item: unknown): TournamentRecord {
  if (!isRecord(item)) {
    throw new CorruptTournamentRecordError(['<item>']);
  }

  const invalid: string[] = [];

  const text = (key: string): string => {
    const value = item[key];
    if (typeof value !== 'string' || value === '') {
      invalid.push(key);
      return '';
    }
    return value;
  };

  const integer = (key: string): number => {
    const value = item[key];
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      invalid.push(key);
      return 0;
    }
    return value;
  };

  const status = TOURNAMENT_STATUSES.find((candidate) => candidate === item['status']);
  if (status === undefined) {
    invalid.push('status');
  }

  // Every field is inspected before throwing, so one bad row reports all of its problems at
  // once instead of one per redeploy. The placeholders below are never returned.
  const record: TournamentRecord = {
    id: text('id'),
    name: text('name'),
    maxParticipants: integer('maxParticipants'),
    inviteCode: text('inviteCode'),
    status: status ?? 'active',
    createdAt: integer('createdAt'),
    updatedAt: integer('updatedAt'),
    hostTokenHash: text('hostTokenHash'),
  };

  const hostAccountId = item['hostAccountId'];
  if (typeof hostAccountId === 'string') {
    record.hostAccountId = hostAccountId;
  } else if (hostAccountId !== undefined) {
    invalid.push('hostAccountId');
  }

  if (invalid.length > 0) {
    throw new CorruptTournamentRecordError(invalid);
  }

  return record;
}
