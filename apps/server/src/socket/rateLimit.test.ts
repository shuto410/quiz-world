/** Fixed windows keep request accounting synchronous and independent by event and socket. */
import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';
describe('createRateLimiter', () => {
  it('accepts exactly the budget, refuses excess, and replenishes at the window boundary', () => {
    const allow = createRateLimiter({ 'game:buzz': { limit: 2, windowMs: 1000 } });
    expect(allow('game:buzz', 10)).toBe(true);
    expect(allow('game:buzz', 11)).toBe(true);
    expect(allow('game:buzz', 1009)).toBe(false);
    expect(allow('game:buzz', 1010)).toBe(true);
  });
  it('isolates events and connection instances, and ignores unknown event names', () => {
    const limits = { 'game:buzz': { limit: 1, windowMs: 1000 } };
    const a = createRateLimiter(limits);
    const b = createRateLimiter(limits);
    expect(a('game:buzz', 0)).toBe(true);
    expect(a('game:buzz', 0)).toBe(false);
    expect(a('participant:rename', 0)).toBe(true);
    expect(b('game:buzz', 0)).toBe(true);
    expect(a('unknown', 0)).toBe(true);
  });
  it('does not replenish early if the clock moves backwards', () => {
    const allow = createRateLimiter({ 'game:buzz': { limit: 1, windowMs: 1000 } });
    expect(allow('game:buzz', 100)).toBe(true);
    expect(allow('game:buzz', 90)).toBe(false);
    expect(allow('game:buzz', 1100)).toBe(true);
  });
  it.each([
    { limit: 0, windowMs: 1 },
    { limit: 1.5, windowMs: 1000 },
    { limit: 1, windowMs: 0 },
    { limit: Infinity, windowMs: 1000 },
  ])('rejects invalid limits %o', (rule) => {
    expect(() => createRateLimiter({ 'game:buzz': rule })).toThrow('invalid rate limit');
  });
});
