/**
 * Tests for the client-side view of the buzz queue.
 *
 * Mirrors what `applyJudge` does with `moveToNextResponder`, so that the button is disabled
 * exactly when the server would refuse it.
 */

import { describe, expect, it } from 'vitest';
import { hasNextResponder } from './hasNextResponder';

const order = [
  { participantId: 'p2', receivedAt: 10 },
  { participantId: 'p3', receivedAt: 20 },
];

describe('hasNextResponder', () => {
  it('is true while somebody is queued behind the responder', () => {
    expect(hasNextResponder({ buzzOrder: order, currentResponderId: 'p2' })).toBe(true);
  });

  it('is false once the responder is last in the order', () => {
    expect(hasNextResponder({ buzzOrder: order, currentResponderId: 'p3' })).toBe(false);
  });

  it('is false when the responder is not in the order at all', () => {
    expect(hasNextResponder({ buzzOrder: order, currentResponderId: 'p9' })).toBe(false);
  });

  it('is false before any state has arrived', () => {
    expect(hasNextResponder({ buzzOrder: undefined, currentResponderId: 'p2' })).toBe(false);
    expect(hasNextResponder({ buzzOrder: order, currentResponderId: undefined })).toBe(false);
  });
});
