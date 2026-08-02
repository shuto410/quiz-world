/**
 * Construction of the DynamoDB document client.
 *
 * The document client is used rather than the low-level one so that repositories deal in
 * plain JavaScript objects and the SDK handles attribute-value marshalling. Every marshalling
 * decision the repositories depend on is set here, in one place.
 *
 * In AWS the client picks up credentials and the region from the task role and the
 * environment. Only when an endpoint is configured, meaning DynamoDB Local or the in-process
 * implementation used by tests, are placeholder credentials supplied: those servers ignore
 * the values but the SDK still refuses to sign a request without them.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export type DynamoDbOptions = {
  region: string;
  /** Set for DynamoDB Local; left unset against the real service. */
  endpoint?: string | undefined;
};

export function createDynamoDbClient({ region, endpoint }: DynamoDbOptions): DynamoDBClient {
  return new DynamoDBClient({
    region,
    ...(endpoint === undefined
      ? {}
      : {
          endpoint,
          credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
        }),
  });
}

export function createDocumentClient(client: DynamoDBClient): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      /**
       * `hostAccountId` is absent until the phase 2 Cognito integration, and an item written
       * with an explicit null would make `attribute_not_exists` checks on it stop working.
       */
      removeUndefinedValues: true,
    },
  });
}
