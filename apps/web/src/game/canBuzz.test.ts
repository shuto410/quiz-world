/**
 * Tests for the client-side buzzer enablement rule.
 *
 * Mirrors the acceptance table of `applyBuzz` so the disabled button matches what the
 * server would refuse, without waiting for a round trip.
 */

import { describe, expect, it } from 'vitest';
import { canBuzz } from './canBuzz';

describe('canBuzz', () => {
  const base = {
    status: 'idle' as const,
    participantId: 'p2',
    hostId: 'p1',
    buzzOrder: [] as const,
  };

  it('allows a seated guest while idle', () => {
    expect(canBuzz(base)).toBe(true);
  });

  it('allows a guest who has not pressed yet while answering', () => {
    expect(
      canBuzz({
        ...base,
        status: 'answering',
        buzzOrder: [{ participantId: 'p3', receivedAt: 1 }],
      }),
    ).toBe(true);
  });

  it('rejects the host seat', () => {
    expect(canBuzz({ ...base, participantId: 'p1' })).toBe(false);
  });

  it('rejects a second press in the same order', () => {
    expect(
      canBuzz({
        ...base,
        status: 'answering',
        buzzOrder: [{ participantId: 'p2', receivedAt: 1 }],
      }),
    ).toBe(false);
  });

  it('rejects result, paused and finished', () => {
    expect(canBuzz({ ...base, status: 'result' })).toBe(false);
    expect(canBuzz({ ...base, status: 'paused' })).toBe(false);
    expect(canBuzz({ ...base, status: 'finished' })).toBe(false);
  });

  it('rejects when identity is unknown', () => {
    expect(canBuzz({ ...base, participantId: undefined })).toBe(false);
    expect(canBuzz({ ...base, hostId: undefined })).toBe(false);
    expect(canBuzz({ ...base, status: undefined })).toBe(false);
  });
});
