/**
 * The only way to reach a room's authoritative state.
 *
 * Today there is one server process and the rooms live in a `Map`, so a plain global object
 * would work just as well. The reason for the indirection is the concept it carries:
 * ownership. Game logic asks the registry for a handle and gets one only if this process
 * owns the room. Nothing reaches into a shared map directly.
 *
 * That matters because of a limit documented in `docs/design.md`: scaling to more than one
 * process cannot be solved by adding the Socket.io Redis adapter. The adapter forwards
 * broadcasts, but it cannot make two processes agree on who buzzed first. The real fix is
 * per-tournament ownership plus routing, and when that day comes, only this module and the
 * connection routing change. Handlers written against `find()` and `update()` keep working.
 *
 * The second job here is atomicity. `update()` takes a synchronous transition, so there is
 * no way to express "read the state, await something, then write it back". That sequence is
 * how buzz ordering silently breaks: Node yields at the await, another buzz is processed,
 * and the write overwrites it.
 */

import type { InternalRoomState } from '@quiz-world/shared';
import type { RoomTransition, TransitionResult } from '../domain/transition';

/**
 * A room this process owns.
 *
 * Handles are invalidated when the room is released, so holding on to one across a
 * tournament's lifetime cannot resurrect a closed room.
 */
export type RoomHandle = {
  readonly tournamentId: string;
  /** Current state. Treat the result as read-only and never mutate it in place. */
  read: () => InternalRoomState;
  /**
   * Runs a transition and, if it is accepted, stores the resulting state.
   *
   * `updatedAt` is stamped here rather than inside each transition, so that it cannot be
   * forgotten by one of them.
   */
  update: (transition: RoomTransition) => TransitionResult;
};

export type RoomRegistry = {
  /**
   * Ensures this process owns the room, seeding it with `initialState` when it is not held
   * yet. If the room is already held, the existing handle is returned and `initialState` is
   * discarded, which is what makes two connections arriving at once harmless.
   */
  claim: (tournamentId: string, initialState: InternalRoomState) => RoomHandle;
  /** The handle for a room this process owns, or `undefined` if it holds no such room. */
  find: (tournamentId: string) => RoomHandle | undefined;
  /** Gives up ownership. Handles previously returned for this room stop working. */
  release: (tournamentId: string) => void;
  /** Every room currently held, for snapshotting and for shutting down cleanly. */
  ownedTournamentIds: () => readonly string[];
};

export type RoomRegistryOptions = {
  /** Wall clock used to stamp `updatedAt`. Injected so that tests stay deterministic. */
  now: () => number;
};

export function createRoomRegistry(options: RoomRegistryOptions): RoomRegistry {
  const rooms = new Map<string, InternalRoomState>();

  const createHandle = (tournamentId: string): RoomHandle => {
    const requireOwned = (): InternalRoomState => {
      const state = rooms.get(tournamentId);
      if (state === undefined) {
        throw new Error(`room ${tournamentId} is no longer owned by this process`);
      }
      return state;
    };

    return {
      tournamentId,
      read: requireOwned,
      update: (transition) => {
        const result = transition(requireOwned());
        if (!result.ok) {
          return result;
        }
        const stamped = { ...result.state, updatedAt: options.now() };
        rooms.set(tournamentId, stamped);
        return { ok: true, state: stamped };
      },
    };
  };

  return {
    claim: (tournamentId, initialState) => {
      if (!rooms.has(tournamentId)) {
        rooms.set(tournamentId, initialState);
      }
      return createHandle(tournamentId);
    },
    find: (tournamentId) => (rooms.has(tournamentId) ? createHandle(tournamentId) : undefined),
    release: (tournamentId) => {
      rooms.delete(tournamentId);
    },
    ownedTournamentIds: () => [...rooms.keys()],
  };
}
