/**
 * Process entry point.
 *
 * Everything testable lives in the modules this file pulls together; what remains here is
 * reading the environment, choosing the real clock and random source, starting to listen, and
 * shutting down when the orchestrator asks.
 *
 * ECS stops a task by sending SIGTERM and killing it a grace period later, so the handler
 * below is what turns a deployment into a clean disconnect rather than a hang.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { loadConfig } from './config';
import { createDocumentClient, createDynamoDbClient } from './db/client';
import { ensureTables } from './db/tables';
import { createLogger } from './logger';
import { createRoomRegistry } from './rooms/roomRegistry';
import { createServer, listen, shutdown } from './server';
import { createDynamoTournamentRepository } from './tournaments/dynamoRepository';

const config = loadConfig(process.env);
const logger = createLogger({ minLevel: config.logLevel });
const registry = createRoomRegistry({ now: () => Date.now() });

const dynamoDbClient = createDynamoDbClient({
  region: config.awsRegion,
  endpoint: config.dynamoDbEndpoint,
});

/**
 * Only DynamoDB Local gets its tables created here. In AWS they belong to the CDK
 * `PersistentStack`, and the task role is not expected to be allowed to create them.
 */
if (config.dynamoDbEndpoint !== undefined) {
  await ensureTables(dynamoDbClient, { tournaments: config.tournamentsTable });
  logger.info('local tables ready', { endpoint: config.dynamoDbEndpoint });
}

const server = createServer({
  logger,
  registry,
  repository: createDynamoTournamentRepository({
    client: createDocumentClient(dynamoDbClient),
    tableName: config.tournamentsTable,
  }),
  randomBytes: (byteLength) => randomBytes(byteLength),
  newTournamentId: () => randomUUID(),
  newParticipantId: () => randomUUID(),
  now: () => Date.now(),
  publicBaseUrl: config.publicBaseUrl,
});

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
