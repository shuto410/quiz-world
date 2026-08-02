/**
 * Tripwire tests for the public URL shapes the SPA advertises.
 *
 * The server builds invite links as `/join?code=...`. If that path moves here without the
 * server changing, every invitation already in the wild breaks. These tests make that
 * disagreement fail in CI instead of in a live room.
 */

import { describe, expect, it } from 'vitest';
import { ROUTE_PATHS, hostPath, joinPath, playPath } from './routes';

describe('ROUTE_PATHS', () => {
  it('keeps the invite entry at /join, matching CreateTournamentResponse.inviteUrl', () => {
    expect(ROUTE_PATHS.join).toBe('/join');
  });

  it('lists every screen the router is expected to mount', () => {
    expect(Object.values(ROUTE_PATHS).sort()).toEqual(
      ['/', '/host/:tournamentId', '/join', '/play/:tournamentId'].sort(),
    );
  });
});

describe('path helpers', () => {
  it('builds a join URL with an encoded invite code', () => {
    expect(joinPath('AB23CD45')).toBe('/join?code=AB23CD45');
    expect(joinPath('A B&C')).toBe('/join?code=A%20B%26C');
  });

  it('returns the bare join path when no code is supplied', () => {
    expect(joinPath()).toBe('/join');
    expect(joinPath('')).toBe('/join');
  });

  it('builds host and play paths from a tournament id', () => {
    expect(hostPath('tournament-1')).toBe('/host/tournament-1');
    expect(playPath('tournament-1')).toBe('/play/tournament-1');
  });
});
