/**
 * Tests for the tournament creation use case.
 *
 * The random source is scripted rather than stubbed per call, so that a test can say which
 * invite code will be generated and then assert on what the collision retry does with it.
 *
 * The recurring theme is the host token: it has to appear in the response, it has to appear
 * nowhere in the stored record, and it has to be recoverable from neither. Several tests here
 * exist only to keep that true.
 */

import type { RandomBytes, TournamentRecord } from '@quiz-world/shared';
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { createTestAppDependencies, TEST_NOW } from '../testing/appDependencies';
import { createInMemoryTournamentRepository } from '../testing/inMemoryTournamentRepository';
import type { CreateTournamentOutcome } from './createTournament';
import { buildInviteUrl, createTournament } from './createTournament';
import { hashHostToken } from './hostToken';

const NOW = TEST_NOW;

/** Bytes that make `generateInviteCode` produce exactly this code. */
function bytesForCode(code: string): Uint8Array {
  return Uint8Array.from([...code], (character) => INVITE_CODE_ALPHABET.indexOf(character));
}

/**
 * A random source that hands out the given invite codes in order, repeating the last one once
 * the list runs out. Requests of any other size are the host token, which no test needs to
 * predict, so those get a fixed filler.
 */
function scriptedRandomBytes(...codes: string[]): RandomBytes {
  let index = 0;

  return (byteLength) => {
    if (byteLength !== INVITE_CODE_LENGTH) {
      return new Uint8Array(byteLength).fill(index);
    }

    const code = codes[Math.min(index, codes.length - 1)] ?? 'AAAAAAAA';
    index += 1;
    return bytesForCode(code);
  };
}

/** The shared defaults, with a random source whose invite codes the test can name. */
const dependenciesWith: typeof createTestAppDependencies = (overrides = {}) =>
  createTestAppDependencies({ randomBytes: scriptedRandomBytes('AB23CD45'), ...overrides });

const validBody = { name: '  社内クイズ大会  ', maxParticipants: 20 };

/** Narrows an outcome that the test expects to have succeeded. */
function expectSuccess(
  outcome: CreateTournamentOutcome,
): Extract<CreateTournamentOutcome, { ok: true }> {
  if (!outcome.ok) {
    throw new Error(`expected success, got ${outcome.code}: ${outcome.message}`);
  }
  return outcome;
}

/** Narrows an outcome that the test expects to have been rejected. */
function expectFailure(
  outcome: CreateTournamentOutcome,
): Extract<CreateTournamentOutcome, { ok: false }> {
  if (outcome.ok) {
    throw new Error('expected the request to be rejected');
  }
  return outcome;
}

describe('input validation', () => {
  it.each([
    ['a body that is not an object', 'a string'],
    ['a null body', null],
    ['an array body', []],
  ])('rejects %s', async (_case, body) => {
    const outcome = expectFailure(await createTournament(dependenciesWith(), body));

    expect(outcome.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['a missing name', { maxParticipants: 20 }],
    ['a blank name', { name: '   ', maxParticipants: 20 }],
    ['a name over the limit', { name: 'あ'.repeat(51), maxParticipants: 20 }],
    ['a name containing a newline', { name: 'a\nb', maxParticipants: 20 }],
    ['a missing capacity', { name: '大会' }],
    ['a capacity below the minimum', { name: '大会', maxParticipants: 1 }],
    ['a capacity above the maximum', { name: '大会', maxParticipants: 51 }],
    ['a capacity sent as a string', { name: '大会', maxParticipants: '20' }],
  ])('rejects %s', async (_case, body) => {
    const dependencies = dependenciesWith();
    const outcome = expectFailure(await createTournament(dependencies, body));

    expect(outcome.code).toBe('VALIDATION_ERROR');
    expect(dependencies.repository.stored()).toEqual([]);
  });

  it('returns the message the client would have shown next to the field', async () => {
    const outcome = expectFailure(
      await createTournament(dependenciesWith(), { name: '大会', maxParticipants: 0 }),
    );

    expect(outcome.message).toBe('最大参加人数は2〜50の整数で入力してください');
  });

  it('reports the name before the capacity when both are wrong', async () => {
    const outcome = expectFailure(
      await createTournament(dependenciesWith(), { name: '', maxParticipants: 0 }),
    );

    expect(outcome.message).toBe('大会名を入力してください');
  });
});

describe('the stored record', () => {
  it('stores the trimmed name', async () => {
    const dependencies = dependenciesWith();
    await createTournament(dependencies, validBody);

    expect(dependencies.repository.stored()[0]?.name).toBe('社内クイズ大会');
  });

  it('opens the tournament immediately, since there is no separate start operation', async () => {
    const dependencies = dependenciesWith();
    await createTournament(dependencies, validBody);

    expect(dependencies.repository.stored()[0]?.status).toBe('active');
  });

  it('stamps both timestamps with the same instant', async () => {
    const dependencies = dependenciesWith();
    await createTournament(dependencies, validBody);

    const stored = dependencies.repository.stored()[0];
    expect(stored?.createdAt).toBe(NOW);
    expect(stored?.updatedAt).toBe(NOW);
  });

  it('leaves hostAccountId unset, since accounts arrive in phase 2', async () => {
    const dependencies = dependenciesWith();
    await createTournament(dependencies, validBody);

    expect(dependencies.repository.stored()[0]).not.toHaveProperty('hostAccountId');
  });

  it('stores the hash of the host token and not the token', async () => {
    const dependencies = dependenciesWith();
    const outcome = expectSuccess(await createTournament(dependencies, validBody));

    const stored = dependencies.repository.stored()[0];
    expect(stored?.hostTokenHash).toBe(hashHostToken(outcome.response.hostToken));
    expect(JSON.stringify(stored)).not.toContain(outcome.response.hostToken);
  });
});

describe('the response', () => {
  it('returns the tournament without the host token hash', async () => {
    const outcome = expectSuccess(await createTournament(dependenciesWith(), validBody));

    expect(outcome.response.tournament).not.toHaveProperty('hostTokenHash');
  });

  it('returns the host token, which is the only time it is ever transmitted', async () => {
    const outcome = expectSuccess(await createTournament(dependenciesWith(), validBody));

    expect(outcome.response.hostToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('builds the invite URL from the configured origin', async () => {
    const outcome = expectSuccess(await createTournament(dependenciesWith(), validBody));

    expect(outcome.response.inviteUrl).toBe('https://quiz.example.com/join?code=AB23CD45');
  });

  it('carries the same invite code in the URL and the tournament', async () => {
    const outcome = expectSuccess(await createTournament(dependenciesWith(), validBody));

    expect(outcome.response.inviteUrl).toContain(outcome.response.tournament.inviteCode);
  });
});

describe('invite code allocation', () => {
  const taken = (inviteCode: string): TournamentRecord => ({
    id: `existing-${inviteCode}`,
    name: '既存の大会',
    maxParticipants: 10,
    inviteCode,
    status: 'active',
    createdAt: NOW - 1,
    updatedAt: NOW - 1,
    hostTokenHash: 'a'.repeat(64),
  });

  it('generates another code when the first one is already in use', async () => {
    const dependencies = dependenciesWith({
      repository: createInMemoryTournamentRepository([taken('AB23CD45')]),
      randomBytes: scriptedRandomBytes('AB23CD45', 'EF67GH89'),
    });

    const outcome = expectSuccess(await createTournament(dependencies, validBody));

    expect(outcome.response.tournament.inviteCode).toBe('EF67GH89');
  });

  it('keeps trying while codes keep colliding', async () => {
    const dependencies = dependenciesWith({
      repository: createInMemoryTournamentRepository([
        taken('AB23CD45'),
        taken('EF67GH89'),
        taken('JKLMNPQR'),
      ]),
      randomBytes: scriptedRandomBytes('AB23CD45', 'EF67GH89', 'JKLMNPQR', 'STUVWXYZ'),
    });

    const outcome = expectSuccess(await createTournament(dependencies, validBody));

    expect(outcome.response.tournament.inviteCode).toBe('STUVWXYZ');
  });

  it('gives up rather than looping forever when every code collides', async () => {
    const dependencies = dependenciesWith({
      repository: createInMemoryTournamentRepository([taken('AB23CD45')]),
      randomBytes: scriptedRandomBytes('AB23CD45'),
    });

    const outcome = expectFailure(await createTournament(dependencies, validBody));

    expect(outcome.code).toBe('INTERNAL_ERROR');
  });

  it('writes nothing when it gives up', async () => {
    const repository = createInMemoryTournamentRepository([taken('AB23CD45')]);
    const dependencies = dependenciesWith({
      repository,
      randomBytes: scriptedRandomBytes('AB23CD45'),
    });

    await createTournament(dependencies, validBody);

    expect(repository.stored()).toHaveLength(1);
  });
});

describe('buildInviteUrl', () => {
  it('escapes the code rather than trusting it to be URL-safe', () => {
    expect(buildInviteUrl('https://quiz.example.com', 'A B&C')).toBe(
      'https://quiz.example.com/join?code=A%20B%26C',
    );
  });
});
