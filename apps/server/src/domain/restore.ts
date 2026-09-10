/** Restores gameplay without trusting socket liveness saved by a previous process. */
import type { InternalRoomState } from '@quiz-world/shared';

export function restoreRoomState(state: InternalRoomState, now: number): InternalRoomState {
  return {
    ...state,
    ...(state.hostId !== '' && state.status !== 'paused' && state.status !== 'finished'
      ? {
          status: 'paused' as const,
          statusBeforePause: state.status,
          pausedReason: 'hostDisconnected' as const,
        }
      : {}),
    hostOnline: false,
    participants: state.participants.map((participant) => ({ ...participant, online: false })),
    updatedAt: now,
  };
}
