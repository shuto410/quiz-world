/** Exercises snapshot serialization, TTL and corruption checks against the DynamoDB protocol. */
import { afterEach, expect, it } from 'vitest';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { startTestDynamoDb, type TestDynamoDb } from '../testing/testDynamoDb';
import { createRoomStateFixture } from '../testing/roomStateFixture';
import { createDynamoSnapshotRepository } from './dynamoRepository';
let db: TestDynamoDb | undefined;
afterEach(async () => {
  await db?.stop();
});
it('round trips full internal state, expires after 24 hours, and deletes idempotently', async () => {
  db = await startTestDynamoDb();
  let now = 1700000000000;
  const repo = createDynamoSnapshotRepository({
    client: db.documentClient,
    tableName: db.snapshotsTable,
    now: () => now,
  });
  const state = createRoomStateFixture({
    currentSubmittedAnswer: { participantId: 'p', answerText: 'secret', receivedAt: now },
  });
  expect(await repo.find(state.tournamentId)).toBeUndefined();
  await repo.save(state);
  expect(await repo.find(state.tournamentId)).toEqual(state);
  const { Item } = await db.documentClient.send(
    new GetCommand({ TableName: db.snapshotsTable, Key: { tournamentId: state.tournamentId } }),
  );
  expect(Item).toMatchObject({
    state: JSON.stringify(state),
    updatedAt: state.updatedAt,
    expiresAt: Math.floor(now / 1000) + 86400,
  });
  now += 86400000;
  expect(await repo.find(state.tournamentId)).toBeUndefined();
  await repo.remove(state.tournamentId);
  await repo.remove(state.tournamentId);
  expect(await repo.find(state.tournamentId)).toBeUndefined();
});
it('refuses malformed or mismatched records instead of silently creating an empty room', async () => {
  db = await startTestDynamoDb();
  const repo = createDynamoSnapshotRepository({
    client: db.documentClient,
    tableName: db.snapshotsTable,
    now: () => 0,
  });
  for (const item of [
    { state: 'not json', expiresAt: 10, updatedAt: 1 },
    { state: '{}', expiresAt: 10, updatedAt: 1 },
    { state: JSON.stringify(createRoomStateFixture()), expiresAt: 10, updatedAt: 1 },
    { state: '{}', expiresAt: '10', updatedAt: 1 },
  ]) {
    await db.documentClient.send(
      new PutCommand({ TableName: db.snapshotsTable, Item: { tournamentId: 'corrupt', ...item } }),
    );
    await expect(repo.find('corrupt')).rejects.toThrow();
  }
});
