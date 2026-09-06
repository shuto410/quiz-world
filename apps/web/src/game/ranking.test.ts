/**
 * Tests for the final standings.
 *
 * The tie cases are the point: a joint first place has to produce two winners and push the
 * next player to third, which is the rule most likely to be written as "index + 1" by
 * accident. The host exclusion is checked in the scenario where it actually matters, a game
 * where nobody scored.
 */

import type { ParticipantState } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { rankParticipants } from './ranking';

function participant(
  id: string,
  name: string,
  score: number,
  joinedAt = 1_700_000_000_000,
): ParticipantState {
  return { id, name, online: true, joinedAt, score };
}

const HOST_ID = 'p1';

describe('rankParticipants', () => {
  it('orders players by score, highest first', () => {
    const ranked = rankParticipants({
      participants: [
        participant(HOST_ID, 'ホスト', 0),
        participant('p2', '太郎', 1),
        participant('p3', '花子', 5),
      ],
      hostId: HOST_ID,
    });

    expect(ranked.map((entry) => [entry.participant.name, entry.rank, entry.isWinner])).toEqual([
      ['花子', 1, true],
      ['太郎', 2, false],
    ]);
  });

  it('gives tied players the same rank and skips the one after', () => {
    const ranked = rankParticipants({
      participants: [
        participant('p2', '太郎', 5, 2),
        participant('p3', '花子', 5, 1),
        participant('p4', '次郎', 2),
      ],
      hostId: HOST_ID,
    });

    expect(ranked.map((entry) => [entry.participant.name, entry.rank, entry.isWinner])).toEqual([
      // Equal scores fall back to who joined first, so the order is stable.
      ['花子', 1, true],
      ['太郎', 1, true],
      ['次郎', 3, false],
    ]);
  });

  it('leaves the host out of the table', () => {
    const ranked = rankParticipants({
      participants: [participant(HOST_ID, 'ホスト', 0), participant('p2', '太郎', 0)],
      hostId: HOST_ID,
    });

    // Nobody scored, so the only winner is still the one who actually played.
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.participant.name).toBe('太郎');
    expect(ranked[0]?.isWinner).toBe(true);
  });

  it('keeps players who left, with the score they finished on', () => {
    const ranked = rankParticipants({
      participants: [{ ...participant('p2', '太郎', 3), online: false }],
      hostId: HOST_ID,
    });

    expect(ranked[0]?.participant.score).toBe(3);
  });

  it('ranks negative scores below zero rather than dropping them', () => {
    const ranked = rankParticipants({
      participants: [participant('p2', '太郎', -2), participant('p3', '花子', 0)],
      hostId: HOST_ID,
    });

    expect(ranked.map((entry) => [entry.participant.name, entry.rank])).toEqual([
      ['花子', 1],
      ['太郎', 2],
    ]);
  });

  it('crowns the least bad score when everyone is negative', () => {
    const ranked = rankParticipants({
      participants: [participant('p2', '太郎', -1), participant('p3', '花子', -5)],
      hostId: HOST_ID,
    });

    expect(ranked[0]?.isWinner).toBe(true);
    expect(ranked[1]?.isWinner).toBe(false);
  });

  it('returns nothing when only the host is in the room', () => {
    expect(
      rankParticipants({ participants: [participant(HOST_ID, 'ホスト', 0)], hostId: HOST_ID }),
    ).toEqual([]);
  });
});
