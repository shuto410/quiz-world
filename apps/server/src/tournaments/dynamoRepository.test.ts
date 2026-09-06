/**
 * Tests for the DynamoDB implementation of the tournament repository.
 *
 * These run against a real DynamoDB implementation in process rather than a mocked client.
 * The mistakes worth catching here are not logic errors — the methods are a few lines each —
 * but disagreements with the table: a misspelled index name, an attribute missing from the
 * key schema, a value that does not survive the round trip. A mock asserting "Query was
 * called with these arguments" would reproduce those mistakes rather than detect them.
 *
 * The table is created by `ensureTables`, the same function the server calls at startup, so
 * the schema under test is the schema the application actually creates.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TournamentRecord } from '@quiz-world/shared';
import { DeleteCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  ConditionalCheckFailedException,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import type { TestDynamoDb } from '../testing/testDynamoDb';
import { startTestDynamoDb } from '../testing/testDynamoDb';
import { createDynamoTournamentRepository } from './dynamoRepository';
import { CorruptTournamentRecordError } from './record';
import { type TournamentRepository, TournamentIdConflictError } from './repository';

const baseRecord: TournamentRecord = {
  id: 'tournament-1',
  name: '社内クイズ大会',
  maxParticipants: 20,
  inviteCode: 'AB23CD45',
  status: 'active',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  hostTokenHash: 'f'.repeat(64),
};

let database: TestDynamoDb;
let repository: TournamentRepository;

beforeAll(async () => {
  database = await startTestDynamoDb();
  repository = createDynamoTournamentRepository({
    client: database.documentClient,
    tableName: database.tournamentsTable,
  });
});

afterAll(async () => {
  await database.stop();
});

beforeEach(async () => {
  const { Items } = await database.documentClient.send(
    new ScanCommand({ TableName: database.tournamentsTable, ProjectionExpression: 'id' }),
  );

  for (const item of Items ?? []) {
    await database.documentClient.send(
      new DeleteCommand({
        TableName: database.tournamentsTable,
        Key: { id: item['id'] as string },
      }),
    );
  }
});

describe('create', () => {
  it('stores a record that comes back unchanged', async () => {
    await repository.create(baseRecord);

    expect(await repository.findById(baseRecord.id)).toEqual(baseRecord);
  });

  it('omits hostAccountId rather than writing a null for it', async () => {
    await repository.create(baseRecord);

    expect(await repository.findById(baseRecord.id)).not.toHaveProperty('hostAccountId');
  });

  it('stores hostAccountId when the phase 2 field is set', async () => {
    await repository.create({ ...baseRecord, hostAccountId: 'cognito-sub' });

    const stored = await repository.findById(baseRecord.id);
    expect(stored?.hostAccountId).toBe('cognito-sub');
  });

  it('refuses to overwrite an existing tournament', async () => {
    await repository.create(baseRecord);

    await expect(repository.create({ ...baseRecord, name: '別の大会' })).rejects.toThrowError(
      TournamentIdConflictError,
    );
  });

  it('reports a failure that is not an id conflict as itself', async () => {
    const wrongTable = createDynamoTournamentRepository({
      client: database.documentClient,
      tableName: 'table-that-was-never-created',
    });

    await expect(wrongTable.create(baseRecord)).rejects.toThrowError(ResourceNotFoundException);
  });

  it('leaves the original intact after a rejected overwrite', async () => {
    await repository.create(baseRecord);
    await repository.create({ ...baseRecord, name: '別の大会' }).catch(() => undefined);

    const stored = await repository.findById(baseRecord.id);
    expect(stored?.name).toBe('社内クイズ大会');
  });
});

describe('findById', () => {
  it('returns undefined for an id that was never created', async () => {
    expect(await repository.findById('missing')).toBeUndefined();
  });

  it('rejects an item that no longer matches the record shape', async () => {
    await database.documentClient.send(
      new PutCommand({
        TableName: database.tournamentsTable,
        Item: { id: 'tournament-1', name: '社内クイズ大会' },
      }),
    );

    await expect(repository.findById('tournament-1')).rejects.toThrowError(
      CorruptTournamentRecordError,
    );
  });
});

describe('findByInviteCode', () => {
  it('finds a tournament through the invite code index', async () => {
    await repository.create(baseRecord);

    expect(await repository.findByInviteCode('AB23CD45')).toEqual(baseRecord);
  });

  it('returns undefined for a code nobody was issued', async () => {
    await repository.create(baseRecord);

    expect(await repository.findByInviteCode('ZZ99ZZ99')).toBeUndefined();
  });

  it('accepts a code typed in lower case', async () => {
    await repository.create(baseRecord);

    expect(await repository.findByInviteCode('ab23cd45')).toEqual(baseRecord);
  });

  it('accepts a code pasted with surrounding whitespace', async () => {
    await repository.create(baseRecord);

    expect(await repository.findByInviteCode('  AB23CD45 ')).toEqual(baseRecord);
  });

  it('returns the tournament whose code matches, not merely the first one stored', async () => {
    await repository.create(baseRecord);
    await repository.create({ ...baseRecord, id: 'tournament-2', inviteCode: 'ZZ99ZZ99' });

    const found = await repository.findByInviteCode('ZZ99ZZ99');
    expect(found?.id).toBe('tournament-2');
  });
});

describe('updateStatus', () => {
  it('closes a tournament and stamps the new time', async () => {
    await repository.create(baseRecord);

    await repository.updateStatus(baseRecord.id, 'closed', 1_700_000_009_000);

    expect(await repository.findById(baseRecord.id)).toEqual({
      ...baseRecord,
      status: 'closed',
      updatedAt: 1_700_000_009_000,
    });
  });

  it('leaves the settings and the token hash alone', async () => {
    await repository.create(baseRecord);

    await repository.updateStatus(baseRecord.id, 'closed', 1_700_000_009_000);

    const stored = await repository.findById(baseRecord.id);
    expect(stored?.hostTokenHash).toBe(baseRecord.hostTokenHash);
    expect(stored?.inviteCode).toBe(baseRecord.inviteCode);
    expect(stored?.maxParticipants).toBe(baseRecord.maxParticipants);
  });

  it('keeps the tournament findable by its invite code afterwards', async () => {
    await repository.create(baseRecord);

    await repository.updateStatus(baseRecord.id, 'closed', 1_700_000_009_000);

    const found = await repository.findByInviteCode(baseRecord.inviteCode);
    expect(found?.status).toBe('closed');
  });

  it('refuses to bring a tournament into existence', async () => {
    await expect(
      repository.updateStatus('never-created', 'closed', 1_700_000_009_000),
    ).rejects.toThrowError(ConditionalCheckFailedException);

    expect(await repository.findById('never-created')).toBeUndefined();
  });
});
