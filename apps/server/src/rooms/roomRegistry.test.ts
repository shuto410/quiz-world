/**
 * Tests for the room registry.
 *
 * Two properties are worth holding on to. Ownership has to be real, meaning a released room
 * cannot be read or written through a handle someone kept a reference to. And a rejected
 * transition has to leave the room exactly as it was, since a half-applied buzz would be
 * worse than a refused one.
 */

import { describe, expect, it } from 'vitest';
import { accept, reject } from '../domain/transition';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { createRoomRegistry } from './roomRegistry';

const fixedClock = (value: number) => () => value;

describe('createRoomRegistry', () => {
  it('reports no rooms before anything is claimed', () => {
    const registry = createRoomRegistry({ now: fixedClock(1) });

    expect(registry.ownedTournamentIds()).toEqual([]);
    expect(registry.find('tournament-1')).toBeUndefined();
  });

  it('hands back the state it was seeded with', () => {
    const registry = createRoomRegistry({ now: fixedClock(1) });
    const state = createRoomStateFixture();

    expect(registry.claim('tournament-1', state).read()).toEqual(state);
    expect(registry.ownedTournamentIds()).toEqual(['tournament-1']);
  });

  it('keeps the first claim when two connections race to load the same room', () => {
    const registry = createRoomRegistry({ now: fixedClock(1) });
    const first = createRoomStateFixture({ hostId: 'participant-1' });
    const second = createRoomStateFixture({ hostId: 'participant-2' });

    registry.claim('tournament-1', first);

    expect(registry.claim('tournament-1', second).read()).toEqual(first);
  });

  it('stores the state an accepted transition returns', () => {
    const registry = createRoomRegistry({ now: fixedClock(1) });
    const handle = registry.claim('tournament-1', createRoomStateFixture());

    const result = handle.update((current) => accept({ ...current, status: 'finished' }));

    if (!result.ok) {
      throw new Error(`expected the transition to be accepted, got ${result.code}`);
    }
    expect(result.state.status).toBe('finished');
    expect(handle.read()).toEqual(result.state);
  });

  it('stamps updatedAt so that no transition has to remember to', () => {
    const registry = createRoomRegistry({ now: fixedClock(1_700_000_009_999) });
    const handle = registry.claim('tournament-1', createRoomStateFixture({ updatedAt: 1 }));

    handle.update((current) => accept({ ...current, status: 'finished' }));

    expect(handle.read().updatedAt).toBe(1_700_000_009_999);
  });

  it('leaves the room untouched when a transition is rejected', () => {
    const registry = createRoomRegistry({ now: fixedClock(1) });
    const state = createRoomStateFixture();
    const handle = registry.claim('tournament-1', state);

    const result = handle.update(() => reject('INVALID_STATE'));

    expect(result).toEqual({ ok: false, code: 'INVALID_STATE' });
    expect(handle.read()).toEqual(state);
  });

  it('finds a claimed room and forgets a released one', () => {
    const registry = createRoomRegistry({ now: fixedClock(1) });
    registry.claim('tournament-1', createRoomStateFixture());

    expect(registry.find('tournament-1')).toBeDefined();

    registry.release('tournament-1');

    expect(registry.find('tournament-1')).toBeUndefined();
    expect(registry.ownedTournamentIds()).toEqual([]);
  });

  it('refuses to serve a handle to a room this process no longer owns', () => {
    const registry = createRoomRegistry({ now: fixedClock(1) });
    const handle = registry.claim('tournament-1', createRoomStateFixture());

    registry.release('tournament-1');

    expect(() => handle.read()).toThrow(/no longer owned/);
    expect(() => handle.update((current) => accept(current))).toThrow(/no longer owned/);
  });

  it('keeps rooms independent of each other', () => {
    const registry = createRoomRegistry({ now: fixedClock(1) });
    const first = registry.claim('tournament-1', createRoomStateFixture());
    const second = registry.claim('tournament-2', createRoomStateFixture());

    first.update((current) => accept({ ...current, status: 'finished' }));

    expect(second.read().status).toBe('idle');
    expect(registry.ownedTournamentIds()).toEqual(['tournament-1', 'tournament-2']);
  });
});
