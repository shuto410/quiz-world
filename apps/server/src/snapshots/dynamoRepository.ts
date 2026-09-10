/** Stores validated internal room JSON with a 24-hour DynamoDB TTL and strongly consistent reads. */
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { parseRoomState } from '@quiz-world/shared';
import type { SnapshotRepository } from './repository';

/** Database connection, table and injectable wall clock for expiration. */
export type DynamoSnapshotOptions = {
  client: DynamoDBDocumentClient;
  tableName: string;
  now: () => number;
};
export function createDynamoSnapshotRepository({
  client,
  tableName,
  now,
}: DynamoSnapshotOptions): SnapshotRepository {
  return {
    async find(tournamentId) {
      const { Item } = await client.send(
        new GetCommand({ TableName: tableName, Key: { tournamentId }, ConsistentRead: true }),
      );
      if (Item === undefined) return undefined;
      if (
        typeof Item['expiresAt'] !== 'number' ||
        !Number.isInteger(Item['expiresAt']) ||
        typeof Item['updatedAt'] !== 'number' ||
        !Number.isFinite(Item['updatedAt']) ||
        typeof Item['state'] !== 'string'
      )
        throw new Error('invalid snapshot metadata');
      if (Item['expiresAt'] <= Math.floor(now() / 1000)) return undefined;
      let json: unknown;
      try {
        json = JSON.parse(Item['state']);
      } catch {
        throw new Error('invalid snapshot JSON');
      }
      const state = parseRoomState(json);
      if (state.tournamentId !== tournamentId || state.updatedAt !== Item['updatedAt'])
        throw new Error('invalid snapshot identity or timestamp');
      return state;
    },
    async save(state) {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            tournamentId: state.tournamentId,
            state: JSON.stringify(state),
            updatedAt: state.updatedAt,
            expiresAt: Math.floor(now() / 1000) + 86400,
          },
        }),
      );
    },
    async remove(tournamentId) {
      await client.send(new DeleteCommand({ TableName: tableName, Key: { tournamentId } }));
    },
  };
}
