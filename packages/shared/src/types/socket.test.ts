/**
 * Tripwire tests keeping the event name constants in step with the event maps.
 *
 * `satisfies` on the constants already rejects a name that is not part of the event map.
 * The opposite direction is what these tests cover: an event added to the map but forgotten
 * in the constant would silently drop out of the exhaustive status-by-event tests that pin
 * down which operations each game status accepts.
 *
 * The `Record<keyof ..., true>` literal is what does the work. It fails to compile until
 * every event is listed, and the comparison then fails until the constant is updated too.
 */

import { describe, expect, it } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from './socket';
import { CLIENT_TO_SERVER_EVENT_NAMES, SERVER_TO_CLIENT_EVENT_NAMES } from './socket';

const everyClientToServerEvent: Record<keyof ClientToServerEvents, true> = {
  'tournament:host-join': true,
  'tournament:join': true,
  'tournament:leave': true,
  'participant:rename': true,
  'host:claim': true,
  'game:buzz': true,
  'answer:submit': true,
  'judge:submit': true,
  'tournament:finish': true,
  'room:close': true,
};

const everyServerToClientEvent: Record<keyof ServerToClientEvents, true> = {
  'room:state': true,
  'room:closed': true,
  'session:invalidated': true,
  error: true,
};

describe('socket event surface', () => {
  it('lists every client-to-server event', () => {
    expect(Object.keys(everyClientToServerEvent).sort()).toEqual(
      [...CLIENT_TO_SERVER_EVENT_NAMES].sort(),
    );
  });

  it('lists every server-to-client event', () => {
    expect(Object.keys(everyServerToClientEvent).sort()).toEqual(
      [...SERVER_TO_CLIENT_EVENT_NAMES].sort(),
    );
  });
});
