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

    expect(loadInviteDetails('tournament-1')).toEqual({
      inviteCode: 'ABCD2345',
      inviteUrl: 'https://quiz.example.com/join?code=ABCD2345',
      name: 'テスト大会',
    });
    expect(loadInviteDetails('missing')).toBeUndefined();
  });
});
