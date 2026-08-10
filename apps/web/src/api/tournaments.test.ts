/**
 * @vitest-environment jsdom
 *
 * Tests for the tournament HTTP helpers. Fetch is stubbed so the assertions stay about
 * URL, method and result shaping rather than the network.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTournament, resolveInviteCode } from './tournaments';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createTournament', () => {
  it('posts the body and returns the created payload', async () => {
    const responseBody = {
      tournament: {
        id: 'tournament-1',
        name: 'テスト',
        maxParticipants: 10,
        inviteCode: 'ABCD2345',
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      },
      inviteUrl: 'https://quiz.example.com/join?code=ABCD2345',
      hostToken: 'token',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseBody),
      }),
    );

    const result = await createTournament({ name: 'テスト', maxParticipants: 10 });

    expect(fetch).toHaveBeenCalledWith('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'テスト', maxParticipants: 10 }),
    });
    expect(result).toEqual({ ok: true, value: responseBody });
  });

  it('maps API errors onto a failed result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({ code: 'VALIDATION_ERROR', message: '大会名を入力してください' }),
      }),
    );

    await expect(createTournament({ name: '', maxParticipants: 10 })).resolves.toEqual({
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: '大会名を入力してください',
    });
  });
});

describe('resolveInviteCode', () => {
  it('requests the invite-code endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            tournamentId: 'tournament-1',
            name: 'テスト',
            status: 'active',
            canJoin: true,
          }),
      }),
    );

    const result = await resolveInviteCode('ABCD2345');

    expect(fetch).toHaveBeenCalledWith('/api/tournaments/by-invite-code/ABCD2345');
    expect(result).toEqual({
      ok: true,
      value: {
        tournamentId: 'tournament-1',
        name: 'テスト',
        status: 'active',
        canJoin: true,
      },
    });
  });
});
