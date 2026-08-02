/**
 * Tripwire test for the boundary between the stored tournament and the published one.
 *
 * `TournamentRecord` carries the host token hash. The only thing standing between that hash
 * and every participant in the room is that the two types are distinct and the conversion
 * lists its output fields explicitly. This test pins the list, so that widening the record
 * cannot silently widen what leaves the server.
 */

import { describe, expect, it } from 'vitest';
import type { Tournament, TournamentRecord } from './tournament';
import { TOURNAMENT_KEYS } from './tournament';

const tournament: Required<Tournament> = {
  id: 'tournament-1',
  name: '社内クイズ大会',
  maxParticipants: 20,
  inviteCode: 'AB23CD45',
  status: 'active',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

/** Every optional field is populated, so the sample carries the maximal key set. */
const record: Required<TournamentRecord> = {
  ...tournament,
  hostTokenHash: 'a'.repeat(64),
  hostAccountId: 'cognito-sub',
};

describe('tournament shape', () => {
  it('keeps Tournament limited to the frozen key list', () => {
    expect(Object.keys(tournament).sort()).toEqual([...TOURNAMENT_KEYS].sort());
  });

  it('adds only server-side fields to the stored record', () => {
    const extra = Object.keys(record).filter(
      (key) => !TOURNAMENT_KEYS.some((published) => published === key),
    );

    expect(extra.sort()).toEqual(['hostAccountId', 'hostTokenHash']);
  });
});
