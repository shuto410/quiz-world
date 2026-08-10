/**
 * Tests for how the DynamoDB client is configured.
 *
 * The branch worth pinning is the credential one. Supplying placeholder credentials is
 * necessary against DynamoDB Local, which ignores them, and wrong in AWS, where doing so
 * would shadow the task role and produce authentication failures that look nothing like a
 * misconfiguration. Presence of an endpoint is what separates the two.
 */

import { describe, expect, it } from 'vitest';
import { createDynamoDbClient } from './client';

describe('createDynamoDbClient', () => {
  it('uses the configured region', async () => {
    const client = createDynamoDbClient({ region: 'ap-northeast-1' });

    await expect(client.config.region()).resolves.toBe('ap-northeast-1');
  });

  it('supplies placeholder credentials when pointed at a local endpoint', async () => {
    const client = createDynamoDbClient({ region: 'local', endpoint: 'http://127.0.0.1:8000' });

    const credentials = await client.config.credentials();
    expect(credentials.accessKeyId).toBe('local');
  });

  it('leaves credentials to the provider chain when no endpoint is set', () => {
    const client = createDynamoDbClient({ region: 'ap-northeast-1' });

    expect(client.config.endpoint).toBeUndefined();
  });
});
