/**
 * The DynamoDB implementation of `TournamentRepository`.
 *
 * Reads go through `parseTournamentRecord` rather than being cast, because the table is
 * schemaless and an item can predate the current code.
 *
 * The records here are small and few, so no pagination is implemented. The invite code query
 * is bounded to one item, and `id` is the partition key, so neither read can span pages.
 */

import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { normalizeInviteCode } from '@quiz-world/shared';
import { INVITE_CODE_INDEX } from '../db/tables';
import { parseTournamentRecord } from './record';
import { type TournamentRepository, TournamentIdConflictError } from './repository';

export type DynamoTournamentRepositoryOptions = {
  client: DynamoDBDocumentClient;
  tableName: string;
};

export function createDynamoTournamentRepository({
  client,
  tableName,
}: DynamoTournamentRepositoryOptions): TournamentRepository {
  return {
    async create(record) {
      try {
        await client.send(
          new PutCommand({
            TableName: tableName,
            Item: record,
            // Turns an id collision into an error instead of silently replacing a tournament
            // that participants may currently be playing in.
            ConditionExpression: 'attribute_not_exists(id)',
          }),
        );
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) {
          throw new TournamentIdConflictError(record.id);
        }
        throw error;
      }
    },

    async findById(id) {
      // Recovery must observe a completed close before deciding whether to seed a room.
      const { Item } = await client.send(
        new GetCommand({ TableName: tableName, Key: { id }, ConsistentRead: true }),
      );

      return Item === undefined ? undefined : parseTournamentRecord(Item);
    },

    async findByInviteCode(inviteCode) {
      const { Items } = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: INVITE_CODE_INDEX,
          KeyConditionExpression: '#inviteCode = :inviteCode',
          // inviteCode is not a DynamoDB reserved word today, but expression attribute names
          // cost nothing and remove the class of failure entirely.
          ExpressionAttributeNames: { '#inviteCode': 'inviteCode' },
          ExpressionAttributeValues: { ':inviteCode': normalizeInviteCode(inviteCode) },
          Limit: 1,
        }),
      );

      const item = Items?.[0];
      return item === undefined ? undefined : parseTournamentRecord(item);
    },

    async updateStatus(id, status, updatedAt) {
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { id },
          UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
          // `status` is a DynamoDB reserved word, so it cannot appear literally here.
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':status': status, ':updatedAt': updatedAt },
          // Without this, UpdateItem would create an item holding nothing but a status.
          ConditionExpression: 'attribute_exists(id)',
        }),
      );
    },
  };
}
