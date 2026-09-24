/** Composes the current participant mode without coupling room membership to gameplay. */
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
import { BuzzerParticipant } from '../modes/buzzer/BuzzerParticipant';
import { RoomSession } from './RoomSession';

/** Connection state and the participant's initial display name. */
type ParticipantRoomViewProps = { connection: UseRoomSocketResult; displayName: string };
export function ParticipantRoomView({ connection, displayName }: ParticipantRoomViewProps) {
  return (
    <RoomSession connection={connection} displayName={displayName} modeName="早押しクイズ">
      <BuzzerParticipant connection={connection} />
    </RoomSession>
  );
}
