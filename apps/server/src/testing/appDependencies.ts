/**
 * Default dependencies for tests that need a working application.
 *
 * Every test that starts the app needs a clock, a random source, an id generator and a
 * repository, and almost none of them care what those are. Collecting the defaults here lets
 * a test override only the one thing it is about.
 *
 * The clock and the random source are fixed rather than real, so that assertions can name
 * exact values instead of matching patterns.
 */

import type { AppDependencies } from '../app';
import { createLogger } from '../logger';
import type { InMemoryTournamentRepository } from './inMemoryTournamentRepository';
import { createInMemoryTournamentRepository } from './inMemoryTournamentRepository';

/** A fixed instant, late enough to be a plausible epoch millisecond value. */
export const TEST_NOW = 1_700_000_000_000;

/**
 * Every byte is 1, which maps to the second character of the invite code alphabet, so the
 * generated code is always `33333333`.
 */
export const TEST_INVITE_CODE = '33333333';

export type TestAppDependencies = AppDependencies & {
  repository: InMemoryTournamentRepository;
};

type Overrides = Partial<Omit<AppDependencies, 'repository'>> & {
  repository?: InMemoryTournamentRepository;
};

export function createTestAppDependencies(overrides: Overrides = {}): TestAppDependencies {
  return {
    // Silent by default: a test that wants to assert on a log line passes its own logger.
    logger: createLogger({ minLevel: 'error', write: () => undefined }),
    randomBytes: (byteLength) => new Uint8Array(byteLength).fill(1),
    newTournamentId: () => 'tournament-1',
    now: () => TEST_NOW,
    publicBaseUrl: 'https://quiz.example.com',
    ...overrides,
    repository: overrides.repository ?? createInMemoryTournamentRepository(),
  };
}
