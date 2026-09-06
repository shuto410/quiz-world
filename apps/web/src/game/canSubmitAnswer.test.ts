/**
 * Tests for the client-side answer-right rule.
 *
 * Mirrors the acceptance table of `applyAnswerSubmit`, so an enabled field means the server
 * would take the answer. The interesting cases are the ones where the viewer did buzz but is
 * queued behind someone else, and the statuses where nobody holds the answer right at all.
 */

import { describe, expect, it } from 'vitest';
import { canSubmitAnswer } from './canSubmitAnswer';

describe('canSubmitAnswer', () => {
  const base = {
    status: 'answering' as const,
    participantId: 'p2',
    currentResponderId: 'p2',
  };

  it('allows the current responder while a round is open', () => {
    expect(canSubmitAnswer(base)).toBe(true);
  });

  it('rejects someone queued behind the responder', () => {
    expect(canSubmitAnswer({ ...base, participantId: 'p3' })).toBe(false);
  });

  it('rejects every status other than answering', () => {
    expect(canSubmitAnswer({ ...base, status: 'idle' })).toBe(false);
    expect(canSubmitAnswer({ ...base, status: 'result' })).toBe(false);
    expect(canSubmitAnswer({ ...base, status: 'paused' })).toBe(false);
    expect(canSubmitAnswer({ ...base, status: 'finished' })).toBe(false);
    expect(canSubmitAnswer({ ...base, status: undefined })).toBe(false);
  });

  it('rejects when identity or the answer right is unknown', () => {
    expect(canSubmitAnswer({ ...base, participantId: undefined })).toBe(false);
    expect(canSubmitAnswer({ ...base, currentResponderId: undefined })).toBe(false);
  });
});
