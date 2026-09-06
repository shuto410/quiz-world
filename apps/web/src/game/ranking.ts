/**
 * The standings, computed on the client from what the server broadcasts.
 *
 * Rank and winner are derived values by design: the server stores scores and nothing else, so
 * that there is no second place for the two to disagree. Ties share a rank and the next rank
 * skips accordingly, and everyone on the top score is a winner — a joint first place is a
 * normal outcome of a quiz, not an edge case to break.
 *
 * The host seat is left out entirely. It exists so that the host has a name and a reconnect
 * path, but the host asks the questions; ranking them alongside the players would put a
 * permanent zero in the table and, in a game where nobody scored, crown the question master.
 */

import type { ParticipantState } from '@quiz-world/shared';

export type RankedParticipant = {
  participant: ParticipantState;
  /** 1-based, shared by ties. */
  rank: number;
  isWinner: boolean;
};

export type RankParticipantsInput = {
  participants: readonly ParticipantState[];
  hostId: string | undefined;
};

/** Orders the players by score, highest first, with joint ranks for equal scores. */
export function rankParticipants({
  participants,
  hostId,
}: RankParticipantsInput): RankedParticipant[] {
  const players = participants.filter((participant) => participant.id !== hostId);

  // Equal scores keep the order they joined in, so the table does not reshuffle between
  // renders for reasons a viewer cannot see.
  const ordered = [...players].sort(
    (left, right) => right.score - left.score || left.joinedAt - right.joinedAt,
  );

  const topScore = ordered[0]?.score;

  let rank = 0;
  let previousScore: number | undefined;

  return ordered.map((participant, index) => {
    if (participant.score !== previousScore) {
      rank = index + 1;
      previousScore = participant.score;
    }

    return {
      participant,
      rank,
      isWinner: participant.score === topScore,
    };
  });
}
