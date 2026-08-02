/**
 * Table definitions and their creation for local development.
 *
 * In AWS the tables are owned by the CDK `PersistentStack`; this module never runs there.
 * It exists so that `docker compose up` followed by starting the server is enough to have a
 * working database, and so that the local schema is defined next to the code that queries it
 * instead of being copied out of the CDK stack by hand.
 *
 * The key schema here and the one in the CDK stack must agree. They are kept honest by the
 * repository tests, which run against this definition: a GSI renamed in one place and not the
 * other makes those tests fail.
 */

import {
  CreateTableCommand,
  type CreateTableCommandInput,
  type DynamoDBClient,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';

/** GSI used to look a tournament up by the code printed on the invitation. */
export const INVITE_CODE_INDEX = 'inviteCode-index';

/**
 * Only the attributes that appear in a key are declared. DynamoDB is schemaless for
 * everything else, so `name`, `status` and the rest need no definition.
 */
export function tournamentsTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'inviteCode', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: INVITE_CODE_INDEX,
        KeySchema: [{ AttributeName: 'inviteCode', KeyType: 'HASH' }],
        /**
         * The join screen needs the name and status, and the collision check needs to know
         * only whether a row exists. Projecting everything keeps both on a single query, and
         * the table holds at most a few thousand small items.
         */
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  };
}

/**
 * Creates the tables if they are missing.
 *
 * Safe to call on every startup. Two processes racing here both succeed, because the second
 * one's `ResourceInUseException` means the table it wanted already exists.
 */
export async function ensureTables(
  client: DynamoDBClient,
  tableNames: { tournaments: string },
): Promise<void> {
  const definitions = [tournamentsTableDefinition(tableNames.tournaments)];

  for (const definition of definitions) {
    try {
      await client.send(new CreateTableCommand(definition));
    } catch (error) {
      if (!(error instanceof ResourceInUseException)) {
        throw error;
      }
    }
  }
}
