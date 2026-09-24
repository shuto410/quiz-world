/** Composes the current host mode inside shared room chrome without owning a socket. */
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
import type { StoredInviteDetails } from '../storage/sessionKeys';
import { BuzzerHost } from '../modes/buzzer/BuzzerHost';
import { RoomSession } from './RoomSession';

/** State and optional creation-time invite information for a host screen. */
type HostRoomViewProps = { connection: UseRoomSocketResult; inviteDetails?: StoredInviteDetails };
export function HostRoomView({ connection, inviteDetails }: HostRoomViewProps) {
  return (
    <RoomSession connection={connection} inviteDetails={inviteDetails} modeName="早押しクイズ">
      <BuzzerHost connection={connection} />
    </RoomSession>
  );
}
