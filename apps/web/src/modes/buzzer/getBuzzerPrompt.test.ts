/** Checks that participant guidance follows authoritative progress, including reconnect precedence. */
import { describe, expect, it } from 'vitest';
import type { RoomStateEvent } from '@quiz-world/shared';
import { getBuzzerPrompt } from './getBuzzerPrompt';

const room: RoomStateEvent = {
  rules: { type: 'points', correctPoints: 1, wrongPoints: 0 },
  tournamentId: 't',
  status: 'answering',
  hostId: 'h',
  hostOnline: true,
  updatedAt: 1,
  participants: [
    { correctCount: 0, wrongCount: 0, id: 'a', name: '太郎', online: true, score: 0, joinedAt: 1 },
  ],
  currentResponderId: 'a',
  buzzOrder: [
    { participantId: 'a', receivedAt: 1 },
    { participantId: 'b', receivedAt: 2 },
  ],
};

describe('getBuzzerPrompt', () => {
  it('waits for participants before suggesting that the host read a question', () => {
    const host = {
      correctCount: 0,
      wrongCount: 0,
      id: 'h',
      name: 'ホスト',
      online: true,
      score: 0,
      joinedAt: 0,
    };
    const emptyRoom = { ...room, status: 'idle' as const, participants: [host] };
    expect(getBuzzerPrompt(emptyRoom, 'h', true).title).toBe('参加者を待っています');
    expect(
      getBuzzerPrompt({ ...emptyRoom, participants: [host, ...room.participants] }, 'h', true),
    ).toMatchObject({ title: '早押しを待っています', description: '問題を読み上げてください。' });
    expect(getBuzzerPrompt(emptyRoom, 'h', false).phase).toBe('接続待ち');
  });
  it('prioritizes resynchronization over a retained answer right', () => {
    expect(getBuzzerPrompt(room, 'a', false).phase).toBe('接続待ち');
  });
  it('prompts the current responder to answer and the host to judge', () => {
    expect(getBuzzerPrompt(room, 'a', true).title).toBe('あなたの回答番です');
    expect(getBuzzerPrompt(room, 'h', true).title).toBe('太郎さんの回答を判定');
  });
  it('distinguishes a queued participant from someone whose turn has passed', () => {
    expect(getBuzzerPrompt(room, 'b', true).title).toBe('早押しを受け付けました');
    expect(getBuzzerPrompt({ ...room, currentResponderId: 'b' }, 'a', true).title).toBe(
      'この問題の回答は終了しました',
    );
  });
  it('allows a late buzz while another person is answering', () => {
    expect(getBuzzerPrompt(room, 'c', true)).toMatchObject({
      phase: '回答中',
      title: '太郎さんが回答中',
    });
  });
  it.each(['result', 'paused', 'finished'] as const)(
    'does not promise an answer turn during %s',
    (status) => {
      expect(getBuzzerPrompt({ ...room, status }, 'a', true).title).not.toBe('あなたの回答番です');
    },
  );
});
