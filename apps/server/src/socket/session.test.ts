/**
 * Tests for the per-socket session helpers.
 */

import { describe, expect, it } from 'vitest';
import { bindSession, clearSession, readSession } from './session';

describe('socket session', () => {
  it('round-trips a bound session', () => {
    const data: Record<string, unknown> = {};
    bindSession(data, {
      tournamentId: 'tournament-1',
      participantId: 'participant-1',
      role: 'host',
    });

    expect(readSession(data)).toEqual({
      tournamentId: 'tournament-1',
      participantId: 'participant-1',
      role: 'host',
    });
  });

  it('rejects incomplete or malformed data', () => {
    expect(readSession(undefined)).toBeUndefined();
    expect(readSession({})).toBeUndefined();
    expect(
      readSession({
        tournamentId: 'tournament-1',
        participantId: 'participant-1',
        role: 'spectator',
      }),
    ).toBeUndefined();
  });

  it('clears identity on leave', () => {
    const data: Record<string, unknown> = {
      tournamentId: 'tournament-1',
      participantId: 'participant-1',
      role: 'participant',
    };

    clearSession(data);

    expect(readSession(data)).toBeUndefined();
  });
});
