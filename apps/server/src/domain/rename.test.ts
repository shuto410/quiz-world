/** Renaming only changes the actor's label, never the seat, score or answer rights. */
import { describe, expect, it } from 'vitest';
import { GAME_STATUSES } from '@quiz-world/shared';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { applyRename } from './rename';
const state = createRoomStateFixture({
  participants: [
    { id: 'h', name: 'ホスト', online: true, score: 0, joinedAt: 1 },
    { id: 'p', name: '太郎', online: true, score: 3, joinedAt: 2 },
  ],
  hostId: 'h',
  currentResponderId: 'p',
});
describe('applyRename', () => {
  it.each(GAME_STATUSES)('keeps seat and game state in %s', (status) => {
    const current = { ...state, status };
    expect(applyRename(current, 'p', '次郎', 10)).toEqual({
      ok: true,
      state: {
        ...current,
        updatedAt: 10,
        participants: [current.participants[0], { ...current.participants[1], name: '次郎' }],
      },
    });
    expect(current.participants[1]?.name).toBe('太郎');
  });
  it('allows the host and accepts keeping the same name', () => {
    expect(applyRename(state, 'h', '司会', 10).ok).toBe(true);
    expect(applyRename(state, 'p', '太郎', 10).ok).toBe(true);
  });
  it('rejects duplicates including offline seats, and unknown or offline actors', () => {
    expect(applyRename(state, 'p', 'ホスト', 10)).toEqual({
      ok: false,
      code: 'DUPLICATE_DISPLAY_NAME',
    });
    expect(applyRename(state, 'missing', '名前', 10)).toEqual({ ok: false, code: 'INVALID_STATE' });
    const offline = {
      ...state,
      participants: state.participants.map((p) => ({ ...p, online: false })),
    };
    expect(applyRename(offline, 'p', '名前', 10)).toEqual({ ok: false, code: 'INVALID_STATE' });
    expect(
      applyRename(
        {
          ...state,
          participants: state.participants.map((p) => (p.id === 'h' ? { ...p, online: false } : p)),
        },
        'p',
        'ホスト',
        10,
      ),
    ).toEqual({ ok: false, code: 'DUPLICATE_DISPLAY_NAME' });
  });
});
