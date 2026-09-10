/** Synchronous per-connection accounting with one bounded counter for each known socket event. */
import { CLIENT_TO_SERVER_EVENT_NAMES, type ClientToServerEventName } from '@quiz-world/shared';
/** Maximum operations in one fixed window; public-launch tuning only changes this policy. */
export type RateLimitRule = { readonly limit: number; readonly windowMs: number };
/** Optional overrides use the same event names as the shared socket contract. */
export type RateLimitOverrides = Partial<Record<ClientToServerEventName, RateLimitRule>>;
/** Deliberately loose MVP policy. Every new event must receive an explicit limit. */
export const SOCKET_RATE_LIMITS: Readonly<Record<ClientToServerEventName, RateLimitRule>> = {
  'tournament:host-join': { limit: 1000, windowMs: 1000 },
  'tournament:join': { limit: 1000, windowMs: 1000 },
  'tournament:leave': { limit: 1000, windowMs: 1000 },
  'participant:rename': { limit: 1000, windowMs: 1000 },
  'host:claim': { limit: 1000, windowMs: 1000 },
  'game:buzz': { limit: 1000, windowMs: 1000 },
  'answer:submit': { limit: 1000, windowMs: 1000 },
  'judge:submit': { limit: 1000, windowMs: 1000 },
  'game:reset': { limit: 1000, windowMs: 1000 },
  'tournament:finish': { limit: 1000, windowMs: 1000 },
  'room:close': { limit: 1000, windowMs: 1000 },
};
/** Counter timestamps are passed in, so the boundary can be tested without timers. */
type Window = { startedAt: number; count: number };
export function createRateLimiter(overrides: RateLimitOverrides = {}) {
  const policy = { ...SOCKET_RATE_LIMITS, ...overrides };
  for (const rule of Object.values(policy)) {
    if (
      !Number.isSafeInteger(rule.limit) ||
      rule.limit < 1 ||
      !Number.isSafeInteger(rule.windowMs) ||
      rule.windowMs < 1
    )
      throw new Error('invalid rate limit');
  }
  const windows = new Map<ClientToServerEventName, Window>();
  return (event: string, now: number): boolean => {
    const name = CLIENT_TO_SERVER_EVENT_NAMES.find((candidate) => candidate === event);
    if (name === undefined) return true;
    const rule = policy[name];
    let window = windows.get(name);
    if (window === undefined || now - window.startedAt >= rule.windowMs) {
      window = { startedAt: now, count: 0 };
      windows.set(name, window);
    }
    if (window.count >= rule.limit) return false;
    window.count += 1;
    return true;
  };
}
