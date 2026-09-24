/** Display ranks are derived from server-owned scores/counts using the shared rule conditions. */
import {
  DEFAULT_GAME_RULES,
  getParticipantStanding,
  type GameRules,
  type ParticipantState,
} from '@quiz-world/shared';
/** Tied players share a display rank; threshold formats recognize every qualifying player. */
export type RankedParticipant = { participant: ParticipantState; rank: number; isWinner: boolean };
/** The host is always excluded from competition. */
export type RankParticipantsInput = {
  participants: readonly ParticipantState[];
  hostId: string | undefined;
  rules?: GameRules | undefined;
};
export function rankParticipants({
  participants,
  hostId,
  rules = DEFAULT_GAME_RULES,
}: RankParticipantsInput): RankedParticipant[] {
  const order = { won: 0, playing: 1, lost: 2 };
  const compare = (a: ParticipantState, b: ParticipantState) =>
    rules.type === 'points'
      ? b.score - a.score
      : order[getParticipantStanding(a, rules)] - order[getParticipantStanding(b, rules)] ||
        b.correctCount - a.correctCount ||
        a.wrongCount - b.wrongCount;
  const ordered = participants
    .filter((p) => p.id !== hostId)
    .sort((a, b) => compare(a, b) || a.joinedAt - b.joinedAt);
  let rank = 0;
  return ordered.map((participant, index) => {
    const previous = ordered[index - 1];
    if (!previous || compare(previous, participant) !== 0) rank = index + 1;
    return {
      participant,
      rank,
      isWinner:
        rules.type === 'points'
          ? participant.score === ordered[0]?.score
          : getParticipantStanding(participant, rules) === 'won',
    };
  });
}
