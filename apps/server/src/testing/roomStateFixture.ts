/**
 * Test-only builder for room states.
 *
 * Tests should say what is different about their scenario and nothing else, so this returns
 * a plausible idle room and lets the caller override just the fields under test.
 *
 * Not part of the running server. It lives under `src` so that it shares the same TypeScript
 * settings as the code it supports.
 */

import type { InternalRoomState } from '@quiz-world/shared';

export function createRoomStateFixture(
  overrides: Partial<InternalRoomState> = {},
): InternalRoomState {
  return {
    tournamentId: 'tournament-1',
    status: 'idle',
    hostId: 'participant-1',
    hostOnline: true,
    participants: [
      {
        id: 'participant-1',
        name: 'ホスト',
        online: true,
        joinedAt: 1_700_000_000_000,
        score: 0,
      },
    ],
    buzzOrder: [],
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}
