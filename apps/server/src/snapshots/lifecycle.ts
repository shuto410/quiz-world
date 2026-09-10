/** Coordinates lazy recovery, bounded pending state, serialized writes and terminal deletion. */
import type { InternalRoomState } from '@quiz-world/shared';
import { createInitialRoomState } from '../domain/join';
import { restoreRoomState } from '../domain/restore';
import type { Logger } from '../logger';
import type { RoomHandle, RoomRegistry } from '../rooms/roomRegistry';
import type { TournamentRepository } from '../tournaments/repository';
import type { SnapshotRepository } from './repository';

/** One queue per tournament; failed writes never poison later work. */
type Queue = {
  pending?: InternalRoomState;
  latest?: InternalRoomState;
  timer?: ReturnType<typeof setTimeout>;
  tail: Promise<void>;
  closing: boolean;
  removal?: Promise<void>;
};
/** Persistence boundary used by joins, finish/close handlers and process shutdown. */
export type SnapshotLifecycle = {
  load: (id: string) => Promise<RoomHandle | undefined>;
  isClosing: (id: string) => boolean;
  flush: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  shutdown: () => Promise<void>;
};
/** Real storage and ownership are injected so delayed failures can be exercised deterministically. */
export type SnapshotLifecycleOptions = {
  registry: RoomRegistry;
  snapshots: SnapshotRepository;
  repository: TournamentRepository;
  logger: Logger;
  now: () => number;
};
export function createSnapshotLifecycle({
  registry,
  snapshots,
  repository,
  logger,
  now,
}: SnapshotLifecycleOptions): SnapshotLifecycle {
  const queues = new Map<string, Queue>();
  const loads = new Map<string, Promise<RoomHandle | undefined>>();
  let stopped = false;
  const queueFor = (id: string): Queue => {
    let queue = queues.get(id);
    if (queue === undefined) {
      queue = { tail: Promise.resolve(), closing: false };
      queues.set(id, queue);
    }
    return queue;
  };
  const clearTimer = (queue: Queue) => {
    clearTimeout(queue.timer);
    queue.timer = undefined;
  };
  const flush = (id: string): Promise<void> => {
    const queue = queueFor(id);
    clearTimer(queue);
    if (queue.closing || queue.pending === undefined) return queue.tail;
    const state = queue.pending;
    queue.pending = undefined;
    queue.tail = queue.tail
      .catch(() => {})
      .then(async () => {
        if (queue.closing) return;
        try {
          await snapshots.save(state);
        } catch (error) {
          if (!queue.closing && queue.pending === undefined && queue.latest === state)
            queue.pending = state;
          throw error;
        }
      });
    return queue.tail;
  };
  const schedule = (state: InternalRoomState) => {
    if (stopped) return;
    const queue = queueFor(state.tournamentId);
    if (queue.closing) return;
    queue.latest = state;
    queue.pending = state;
    if (queue.timer !== undefined) return;
    queue.timer = setTimeout(() => {
      void flush(state.tournamentId).catch((error) =>
        logger.error('snapshot write failed', { tournamentId: state.tournamentId, error }),
      );
    }, 200);
  };
  const unsubscribe = registry.subscribe(schedule);
  return {
    isClosing: (id) => queues.get(id)?.closing === true,
    load(id) {
      if (stopped || queues.get(id)?.closing === true) return Promise.resolve(undefined);
      const owned = registry.find(id);
      if (owned !== undefined) return Promise.resolve(owned);
      const existing = loads.get(id);
      if (existing !== undefined) return existing;
      const loading = (async () => {
        const snapshot = await snapshots.find(id);
        // Re-read after storage I/O: a concurrent close must not seed a new empty room.
        const tournament = await repository.findById(id);
        if (stopped || queues.get(id)?.closing === true || tournament === undefined)
          return undefined;
        if (tournament.status === 'closed' && snapshot?.status !== 'finished') return undefined;
        return registry.claim(
          id,
          snapshot === undefined
            ? createInitialRoomState(id, now())
            : restoreRoomState(snapshot, now()),
        );
      })().finally(() => {
        loads.delete(id);
      });
      loads.set(id, loading);
      return loading;
    },
    flush,
    remove(id) {
      const queue = queueFor(id);
      if (queue.removal !== undefined) return queue.removal;
      queue.closing = true;
      clearTimer(queue);
      queue.pending = undefined;
      queue.removal = queue.tail
        .catch(() => {})
        .then(() => snapshots.remove(id))
        .catch((error) => {
          queue.closing = false;
          queue.removal = undefined;
          const room = registry.find(id);
          if (room !== undefined) schedule(room.read());
          throw error;
        });
      return queue.removal;
    },
    async shutdown() {
      stopped = true;
      unsubscribe();
      await Promise.all([...loads.values()].map((load) => load.catch(() => {})));
      await Promise.all([...queues.keys()].map(flush));
    },
  };
}
