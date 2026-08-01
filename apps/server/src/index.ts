/**
 * Process entry point.
 *
 * Everything testable lives in the modules this file pulls together; what remains here is
 * reading the environment, starting to listen, and shutting down when the orchestrator asks.
 *
 * ECS stops a task by sending SIGTERM and killing it a grace period later, so the handler
 * below is what turns a deployment into a clean disconnect rather than a hang.
 */

import { loadConfig } from './config';
import { createLogger } from './logger';
import { createRoomRegistry } from './rooms/roomRegistry';
import { createServer, listen, shutdown } from './server';

const config = loadConfig(process.env);
const logger = createLogger({ minLevel: config.logLevel });
const registry = createRoomRegistry({ now: () => Date.now() });

const server = createServer({ logger, registry });

await listen(server.httpServer, config.port);
logger.info('server listening', { port: config.port });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    logger.info('shutting down', { signal });
    void shutdown(server).then(
      () => {
        process.exit(0);
      },
      (error: unknown) => {
        logger.error('shutdown failed', { error });
        process.exit(1);
      },
    );
  });
}
