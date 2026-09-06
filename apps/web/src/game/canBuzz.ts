/**
 * Whether the viewer's buzzer should be enabled.
 *
 * Derived from the broadcast room state — never stored on the server. Matches the rules in
 * `applyBuzz`: only seated non-host participants may press, and only while the room is
 * `idle` or `answering` and they have not already entered the current order.
 */

import type { BuzzEntry, GameStatus } from '@quiz-world/shared';

export type CanBuzzInput = {
  status: GameStatus | undefined;
  participantId: string | undefined;
  hostId: string | undefined;
  buzzOrder: readonly BuzzEntry[] | undefined;
};

/** True when pressing the buzzer would be accepted by the server right now. */
export function canBuzz({ status, participantId, hostId, buzzOrder }: CanBuzzInput): boolean {
  if (status === undefined || participantId === undefined || hostId === undefined) {
    return false;
  }
  if (participantId === hostId) {
    return false;
  }
  if (status !== 'idle' && status !== 'answering') {
    return false;
  }
  const order = buzzOrder ?? [];
  return !order.some((entry) => entry.participantId === participantId);
}
