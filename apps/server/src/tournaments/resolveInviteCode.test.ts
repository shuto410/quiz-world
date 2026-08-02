/**
 * Tests for looking a tournament up by invite code.
 *
 * The join screen is the only caller, and it must learn two things: which tournament the
 * code points at, and whether the status still allows joining. Capacity is deliberately
 * left out — it changes by the second, and the binding check happens on the socket.
 *
 * The other thing these tests guard against is a leak. The stored record carries a host
 * token hash; the response must not.
 */

import type { TournamentRecord } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createInMemoryTournamentRepository } from '../testing/inMemoryTournamentRepository';
import { TEST_NOW } from '../testing/appDependencies';
import type { ResolveInviteCodeOutcome } from './resolveInviteCode';
import { resolveInviteCode } from './resolveInviteCode';

const active: TournamentRecord = {
  id: 'tournament-1',
  name: '社内クイズ大会',
  maxParticipants: 20,
  inviteCode: 'AB23CD45',
  status: 'active',
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  hostTokenHash: 'f'.repeat(64),
};

const closed: TournamentRecord = {
  ...active,
  id: 'tournament-2',
  inviteCode: 'EF67GH89',
  status: 'closed',
};

function expectSuccess(
  outcome: ResolveInviteCodeOutcome,
): Extract<ResolveInviteCodeOutcome, { ok: true }> {
  if (!outcome.ok) {
    throw new Error(`expected success, got ${outcome.code}: ${outcome.message}`);
  }
  return outcome;
}

function expectFailure(
  outcome: ResolveInviteCodeOutcome,
): Extract<ResolveInviteCodeOutcome, { ok: false }> {
  if (outcome.ok) {
    throw new Error('expected the lookup to be rejected');
  }
  return outcome;
}

describe('resolveInviteCode', () => {
  it('returns the public fields of an active tournament', async () => {
    const repository = createInMemoryTournamentRepository([active]);

    const outcome = expectSuccess(await resolveInviteCode({ repository }, 'AB23CD45'));

    expect(outcome.response).toEqual({
      tournamentId: 'tournament-1',
      name: '社内クイズ大会',
      status: 'active',
      canJoin: true,
    });
  });

  it('marks a closed tournament as not joinable without refusing the lookup', async () => {
    const repository = createInMemoryTournamentRepository([closed]);

    const outcome = expectSuccess(await resolveInviteCode({ repository }, 'EF67GH89'));

    expect(outcome.response.canJoin).toBe(false);
    expect(outcome.response.status).toBe('closed');
    expect(outcome.response.name).toBe('社内クイズ大会');
  });

  it('never puts the host token hash in the response', async () => {
    const repository = createInMemoryTournamentRepository([
      { ...active, hostAccountId: 'cognito-sub' },
    ]);

    const outcome = expectSuccess(await resolveInviteCode({ repository }, 'AB23CD45'));

    expect(outcome.response).not.toHaveProperty('hostTokenHash');
    expect(outcome.response).not.toHaveProperty('hostAccountId');
    expect(outcome.response).not.toHaveProperty('maxParticipants');
    expect(JSON.stringify(outcome.response)).not.toContain('f'.repeat(64));
  });

  it('accepts a code typed in lower case', async () => {
    const repository = createInMemoryTournamentRepository([active]);

    const outcome = expectSuccess(await resolveInviteCode({ repository }, 'ab23cd45'));

    expect(outcome.response.tournamentId).toBe('tournament-1');
  });

  it('accepts a code pasted with surrounding whitespace', async () => {
    const repository = createInMemoryTournamentRepository([active]);

    const outcome = expectSuccess(await resolveInviteCode({ repository }, '  AB23CD45 '));

    expect(outcome.response.tournamentId).toBe('tournament-1');
  });

  it.each([
    ['too short', 'AB23'],
    ['ambiguous characters', 'AB23IO01'],
    ['empty', ''],
    ['not a string', 42],
  ])('rejects %s as a validation error rather than as not found', async (_case, code) => {
    const repository = createInMemoryTournamentRepository([active]);

    const outcome = expectFailure(await resolveInviteCode({ repository }, code));

    expect(outcome.code).toBe('VALIDATION_ERROR');
    expect(outcome.message).toBe('招待コードは8文字の英数字です');
  });

  it('reports a well-formed code that matches nothing as not found', async () => {
    const repository = createInMemoryTournamentRepository([active]);

    const outcome = expectFailure(await resolveInviteCode({ repository }, 'ZZ99ZZ99'));

    expect(outcome.code).toBe('TOURNAMENT_NOT_FOUND');
    expect(outcome.message).toBe('大会が見つかりません');
  });

  it('does not reveal whether a nearby code exists when the typed one is malformed', async () => {
    const repository = createInMemoryTournamentRepository([active]);

    const outcome = expectFailure(await resolveInviteCode({ repository }, 'AB23CD4'));

    // A 404 for a near-miss would tell an attacker which characters are close. Validation
    // happens before the lookup, so the shape of the code is the only thing reported.
    expect(outcome.code).toBe('VALIDATION_ERROR');
  });
});
