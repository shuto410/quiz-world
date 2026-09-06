/**
 * Whether the answer right can still be passed on within the current round.
 *
 * Used to disable the host's "next responder" button rather than to decide anything: the
 * server refuses with `NO_NEXT_RESPONDER` either way. The rule mirrors `applyJudge`, which
 * looks at the entry after the current responder in `buzzOrder` and does not skip anyone.
 */

import type { BuzzEntry } from '@quiz-world/shared';

export type HasNextResponderInput = {
  buzzOrder: readonly BuzzEntry[] | undefined;
  currentResponderId: string | undefined;
};

/** True when somebody is queued behind the participant holding the answer right. */
export function hasNextResponder({
  buzzOrder,
  currentResponderId,
}: HasNextResponderInput): boolean {
  if (buzzOrder === undefined || currentResponderId === undefined) {
    return false;
  }

  const current = buzzOrder.findIndex((entry) => entry.participantId === currentResponderId);
  if (current === -1) {
    return false;
  }

  return current + 1 < buzzOrder.length;
}
