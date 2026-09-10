/** Changes one online seat's name synchronously; field validation belongs to the shared validator. */
import type { InternalRoomState } from '@quiz-world/shared';
import { accept, reject, type TransitionResult } from './transition';
export function applyRename(
  current: InternalRoomState,
  actorId: string,
  name: string,
  now: number,
): TransitionResult {
  const actor = current.participants.find((p) => p.id === actorId);
  if (actor === undefined || !actor.online) return reject('INVALID_STATE');
  if (current.participants.some((p) => p.id !== actorId && p.name === name))
    return reject('DUPLICATE_DISPLAY_NAME');
  return accept({
    ...current,
    participants: current.participants.map((p) => (p.id === actorId ? { ...p, name } : p)),
    updatedAt: now,
  });
}
