/**
 * Process entry point for browser end-to-end runs.
 *
 * Playwright needs a whole server to point a browser at, and `npm run check` must keep working
 * without Docker, so this starts the application against the in-process DynamoDB instead of
 * DynamoDB Local. Everything else is the production wiring: the real repositories, the real
 * clock and real random ids, read from the same environment variables as `index.ts`.
 *
 * It does not simply import `index.ts`, because that entry point also configures the snapshot
 * TTL when it is given an endpoint, and dynalite does not implement the TTL control API. The
 * tables are created by `startTestDynamoDb()`, which uses the same `ensureTables` as startup.
 *
 * Every run starts from an empty database, which is what lets a scenario assert exact scores.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { loadConfig } from '../config';
import { createLogger } from '../logger';
import { createRoomRegistry } from '../rooms/roomRegistry';
import { createServer, listen, shutdown } from '../server';
import { createDynamoSnapshotRepository } from '../snapshots/dynamoRepository';
import { createDynamoTournamentRepository } from '../tournaments/dynamoRepository';
import { startTestDynamoDb } from './testDynamoDb';

const config = loadConfig(process.env);
const logger = createLogger({ minLevel: config.logLevel });
const database = await startTestDynamoDb();

const server = createServer({
  logger,
  registry: createRoomRegistry({ now: () => Date.now() }),
  snapshots: createDynamoSnapshotRepository({
    client: database.documentClient,
    tableName: database.snapshotsTable,
    now: () => Date.now(),
  }),
  repository: createDynamoTournamentRepository({
    client: database.documentClient,
    tableName: database.tournamentsTable,
  }),
  randomBytes: (byteLength) => randomBytes(byteLength),
  newTournamentId: () => randomUUID(),
  newParticipantId: () => randomUUID(),
  newBuzzSessionId: () => randomUUID(),
  now: () => Date.now(),
  publicBaseUrl: config.publicBaseUrl,
});

await listen(server.httpServer, config.port);
logger.info('e2e server listening', { port: config.port });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void shutdown(server)
      .then(() => database.stop())
      .then(
        () => {
          process.exit(0);
        },
        (error: unknown) => {
          logger.error('e2e shutdown failed', { error });
          process.exit(1);
        },
      );
  });
}
