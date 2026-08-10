/**
 * Tests for the boundary between the stored tournament and the published one.
 *
 * The publishing direction is checked by key set rather than by listing expected values,
 * because the failure being guarded against is an extra key appearing, not a wrong value.
 *
 * The reading direction is checked field by field, since a schemaless table means any of them
 * can be missing or the wrong type in an item written by an older deployment.
 */

import type { TournamentRecord } from '@quiz-world/shared';
import { TOURNAMENT_KEYS } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { CorruptTournamentRecordError, parseTournamentRecord, toTournament } from './record';

const record: TournamentRecord = {
  id: 'tournament-1',
  name: '社内クイズ大会',
  maxParticipants: 20,
  inviteCode: 'AB23CD45',
  status: 'active',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_500,
  hostTokenHash: 'f'.repeat(64),
};

describe('toTournament', () => {
  it('publishes exactly the fields clients are allowed to see', () => {
    expect(Object.keys(toTournament(record)).sort()).toEqual([...TOURNAMENT_KEYS].sort());
  });

  it('drops the host token hash even when the record also carries an account id', () => {
    const published = toTournament({ ...record, hostAccountId: 'cognito-sub' });

    expect(published).not.toHaveProperty('hostTokenHash');
    expect(published).not.toHaveProperty('hostAccountId');
  });

  it('preserves the values it does publish', () => {
    expect(toTournament(record)).toEqual({
      id: 'tournament-1',
      name: '社内クイズ大会',
      maxParticipants: 20,
      inviteCode: 'AB23CD45',
      status: 'active',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_500,
    });
  });
});

describe('parseTournamentRecord', () => {
  it('accepts an item written by this version of the code', () => {
    expect(parseTournamentRecord({ ...record })).toEqual(record);
  });

  it('keeps hostAccountId when it is present', () => {
    const parsed = parseTournamentRecord({ ...record, hostAccountId: 'cognito-sub' });

    expect(parsed.hostAccountId).toBe('cognito-sub');
  });

  it('leaves hostAccountId unset when it is absent, rather than setting it to null', () => {
    expect(parseTournamentRecord({ ...record })).not.toHaveProperty('hostAccountId');
  });

  it('drops attributes the code does not know about', () => {
    const parsed = parseTournamentRecord({ ...record, leftoverFromAnOldVersion: 'x' });

    expect(parsed).not.toHaveProperty('leftoverFromAnOldVersion');
  });

  it.each([
    ['a missing field', { ...record, name: undefined }, 'name'],
    ['a field of the wrong type', { ...record, maxParticipants: '20' }, 'maxParticipants'],
    ['a non-integer timestamp', { ...record, createdAt: 1.5 }, 'createdAt'],
    ['an empty string where a value is required', { ...record, id: '' }, 'id'],
    ['a status outside the known set', { ...record, status: 'archived' }, 'status'],
    ['a hostAccountId of the wrong type', { ...record, hostAccountId: 42 }, 'hostAccountId'],
  ])('rejects %s', (_case, item, field) => {
    expect(() => parseTournamentRecord(item)).toThrowError(
      new RegExp(`invalid fields: .*${field}`),
    );
  });

  it('names every invalid field at once, so one redeploy is enough to fix them', () => {
    const attempt = (): TournamentRecord => parseTournamentRecord({ ...record, id: 1, name: 2 });

    expect(attempt).toThrowError(CorruptTournamentRecordError);
    expect(attempt).toThrowError(/invalid fields: id, name/);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'tournament'],
  ])('rejects %s, which cannot be an item', (_case, item) => {
    expect(() => parseTournamentRecord(item)).toThrowError(CorruptTournamentRecordError);
  });

  it('never lets a corrupt record error quote a stored value', () => {
    const secret = 'f'.repeat(64);
    const attempt = (): TournamentRecord =>
      parseTournamentRecord({ ...record, hostTokenHash: secret, name: 1 });

    expect(attempt).toThrowError(/invalid fields/);
    expect(() => attempt()).not.toThrowError(new RegExp(secret));
  });
});
