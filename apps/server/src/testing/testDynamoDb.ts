/**
 * An isolated DynamoDB for a single test file.
 *
 * `dynalite` implements the DynamoDB wire protocol in process, so the repository tests
 * exercise the real AWS SDK, the real key schema and the real index against a real
 * implementation of the API, without Docker and without a network. A mocked client would let
 * a misspelled `IndexName` or a missing attribute definition pass, which is exactly the class
 * of mistake these tests exist to catch.
 *
 * It is not a substitute for DynamoDB Local when verifying by hand; it is what makes
 * `npm run check` self-contained.
 */

import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dynalite from 'dynalite';
import { createDocumentClient, createDynamoDbClient } from '../db/client';
import { ensureTables } from '../db/tables';

export type TestDynamoDb = {
  client: DynamoDBClient;
  documentClient: DynamoDBDocumentClient;
  tournamentsTable: string;
  snapshotsTable: string;
  stop: () => Promise<void>;
};

/** Starts a server on an ephemeral port and creates the application's tables. */
export async function startTestDynamoDb(): Promise<TestDynamoDb> {
  // Table creation is normally asynchronous; making it instant means tests do not have to
  // wait for a table to leave the CREATING state before writing to it.
  const server = dynalite({ createTableMs: 0 });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, resolve);
  });

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('dynalite did not bind to a TCP port');
  }

  const client = createDynamoDbClient({
    region: 'local',
    endpoint: `http://127.0.0.1:${address.port}`,
  });
  const documentClient = createDocumentClient(client);
  const tournamentsTable = 'test-tournaments';

  const snapshotsTable = 'test-room-snapshots';
  await ensureTables(client, { tournaments: tournamentsTable, snapshots: snapshotsTable });

  return {
    client,
    documentClient,
    tournamentsTable,
    snapshotsTable,
    stop: async () => {
      documentClient.destroy();
      await new Promise<void>((resolve, reject) => {
        // dynalite reports success by passing null rather than by omitting the argument, so
        // the check has to be for a falsy value and not for undefined.
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  };
}
