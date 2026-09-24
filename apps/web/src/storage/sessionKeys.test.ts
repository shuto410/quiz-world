/**
 * @vitest-environment jsdom
 *
 * Tests for the localStorage key helpers used across host and play screens.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  hostTokenKey,
  loadHostToken,
  loadInviteDetails,
  loadParticipantId,
  participantIdKey,
  saveHostToken,
  saveInviteDetails,
  saveParticipantId,
  saveParticipantName,
  loadParticipantName,
  loadTournamentName,
  saveTournamentName,
  inviteDetailsKey,
} from './sessionKeys';

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('sessionKeys', () => {
  it('scopes host tokens and participant ids by tournament', () => {
    saveHostToken('tournament-1', 'token-a');
    saveParticipantId('tournament-1', 'participant-1');
    saveHostToken('tournament-2', 'token-b');

    expect(loadHostToken('tournament-1')).toBe('token-a');
    expect(loadParticipantId('tournament-1')).toBe('participant-1');
    expect(loadHostToken('tournament-2')).toBe('token-b');
    expect(loadParticipantId('tournament-2')).toBeUndefined();
    expect(hostTokenKey('tournament-1')).not.toBe(participantIdKey('tournament-1'));
  });

  it('stores invite details for the host screen', () => {
    saveInviteDetails('tournament-1', {
      inviteCode: 'ABCD2345',
      inviteUrl: 'https://quiz.example.com/join?code=ABCD2345',
      name: 'テスト大会',
    });

    window.sessionStorage.clear();
    expect(loadTournamentName('tournament-1')).toBe('テスト大会');
    expect(loadInviteDetails('tournament-1')).toEqual({
      inviteCode: 'ABCD2345',
      inviteUrl: 'https://quiz.example.com/join?code=ABCD2345',
      name: 'テスト大会',
    });
    expect(loadInviteDetails('missing')).toBeUndefined();
  });
});

it('keeps reconnect names isolated by tournament', () => {
  saveParticipantName('t1', '旧ホスト');
  saveParticipantName('t2', '太郎');
  expect(loadParticipantName('t1')).toBe('旧ホスト');
  expect(loadParticipantName('t2')).toBe('太郎');
  expect(loadParticipantName('t3')).toBeUndefined();
});

it('reads legacy invitation data and keeps participant tournament names isolated', () => {
  window.sessionStorage.setItem(
    inviteDetailsKey('legacy'),
    JSON.stringify({
      inviteCode: 'ABCD2345',
      inviteUrl: 'https://quiz.example.com/join?code=ABCD2345',
      name: '以前の大会',
    }),
  );
  expect(loadInviteDetails('legacy')?.name).toBe('以前の大会');
  saveTournamentName('participant-room', '参加中の大会');
  expect(loadTournamentName('participant-room')).toBe('参加中の大会');
  expect(loadTournamentName('missing')).toBeUndefined();
});
