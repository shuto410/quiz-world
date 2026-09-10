/** Persistence operations for a single room's short-lived recovery state. */
import type { InternalRoomState } from '@quiz-world/shared';

/** An expired snapshot is returned as missing even if DynamoDB has not deleted it yet. */
export type SnapshotRepository = {
  find: (tournamentId: string) => Promise<InternalRoomState | undefined>;
  save: (state: InternalRoomState) => Promise<void>;
  remove: (tournamentId: string) => Promise<void>;
};
