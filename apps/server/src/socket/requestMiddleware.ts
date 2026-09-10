/** One ingress gate rejects stale or excessive requests before handlers can read or change rooms. */
import type { AckFailure, ClientToServerEvents, ServerToClientEvents } from '@quiz-world/shared';
import type { Socket } from 'socket.io';
import type { Connections } from './connections';
import { socketErrorMessage } from './errorMessages';
import { createRateLimiter, type RateLimitOverrides } from './rateLimit';
/** Connection authority, clock and optional policy overrides for one socket's lifetime. */
type RequestMiddlewareOptions = {
  connections: Connections;
  now: () => number;
  rateLimits?: RateLimitOverrides;
};
export function registerRequestMiddleware(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  options: RequestMiddlewareOptions,
): void {
  const allow = createRateLimiter(options.rateLimits);
  socket.use(([event, ...args], next) => {
    const code = options.connections.isInvalidated(socket)
      ? 'STALE_CONNECTION'
      : allow(event, options.now())
        ? undefined
        : 'RATE_LIMITED';
    if (code === undefined) {
      next();
      return;
    }
    const failure: AckFailure = { ok: false, code, message: socketErrorMessage(code) };
    const ack: unknown = args.at(-1);
    if (typeof ack === 'function') (ack as (response: AckFailure) => void)(failure);
    else socket.emit('error', { code, message: failure.message });
  });
}
