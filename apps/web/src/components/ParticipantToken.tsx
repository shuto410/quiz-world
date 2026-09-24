/** A decorative playing piece gives the same seat a consistent color across room views. */
import './ParticipantToken.css';

const TONES = ['sage', 'ochre', 'blue', 'rose', 'plum', 'clay'] as const;

/** Identity determines appearance; the parent supplies the server-confirmed active state. */
type ParticipantTokenProps = { participantId: string; active?: boolean };

export function ParticipantToken({ participantId, active = false }: ParticipantTokenProps) {
  let hash = 0;
  for (const character of participantId) {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  }
  const tone = TONES[hash % TONES.length] ?? TONES[0];
  return (
    <span
      className="qw-participant-token"
      data-tone={tone}
      data-active={active}
      aria-hidden="true"
    />
  );
}
