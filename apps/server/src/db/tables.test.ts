/**
 * Tests for local table creation.
 *
 * `ensureTables` runs on every local startup, so the property that matters is that the second
 * run is harmless. If it were not, restarting the dev server against an existing DynamoDB
 * Local would fail, and the obvious workaround — deleting the volume — would take the day's
 * test data with it.
 */

import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { afterEach, describe, expect, it } from 'vitest';
import type { TestDynamoDb } from '../testing/testDynamoDb';
import { startTestDynamoDb } from '../testing/testDynamoDb';
import { ensureTables, INVITE_CODE_INDEX, tournamentsTableDefinition } from './tables';

let database: TestDynamoDb | undefined;

afterEach(async () => {
  await database?.stop();
  database = undefined;
});

describe('ensureTables', () => {
  it('creates the tournaments table with its invite code index', async () => {
    database = await startTestDynamoDb();

    const { Table } = await database.client.send(
      new DescribeTableCommand({ TableName: database.tournamentsTable }),
    );

    expect(Table?.KeySchema).toEqual([{ AttributeName: 'id', KeyType: 'HASH' }]);
    expect(Table?.GlobalSecondaryIndexes?.map((index) => index.IndexName)).toEqual([
      INVITE_CODE_INDEX,
    ]);
  });

  it('is safe to run again against a database that already has the tables', async () => {
    database = await startTestDynamoDb();

    await expect(
      ensureTables(database.client, { tournaments: database.tournamentsTable }),
    ).resolves.toBeUndefined();
  });

  it('reports a failure that is not "the table is already there"', async () => {
    database = await startTestDynamoDb();

    // Two characters is below DynamoDB's minimum table name length, so the request is
    // rejected for a reason that must not be mistaken for the table already existing.
    await expect(ensureTables(database.client, { tournaments: 'ab' })).rejects.toThrowError(
      /TableName/,
    );
  });

  it('projects every attribute, so one query answers both the lookup and the join screen', () => {
    const definition = tournamentsTableDefinition('tournaments');

    expect(definition.GlobalSecondaryIndexes?.[0]?.Projection).toEqual({ ProjectionType: 'ALL' });
  });

  it('bills per request, so an idle table costs nothing between tournaments', () => {
    expect(tournamentsTableDefinition('tournaments').BillingMode).toBe('PAY_PER_REQUEST');
  });
});
