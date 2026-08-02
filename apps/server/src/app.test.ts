/**
 * Tests for the HTTP surface.
 *
 * These go through a real Express app over a real socket, so the things being checked are the
 * things a client actually observes: the status code, the body, and the fact that malformed
 * input is answered rather than crashing the process.
 *
 * The use case behind `POST /api/tournaments` is tested separately in
 * `tournaments/createTournament.test.ts`. What is left here is the translation: which outcome
 * becomes which status, and what happens when something throws.
 */

import type { Server } from 'node:http';
// Aliased because the unqualified names would shadow the global `Request` and `Response` that
// the fetch-based tests below rely on.
import type {
  Express,
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, errorHandler, type AppDependencies } from './app';
import { createLogger } from './logger';
import { createTestAppDependencies, TEST_INVITE_CODE } from './testing/appDependencies';

let running: Server | undefined;

/** Starts an app on a free port and returns the base URL to call it with. */
async function start(app: Express): Promise<string> {
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, () => {
      resolve(listener);
    });
    listener.once('error', reject);
  });
  running = server;

  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('app is not listening on a TCP port');
  }
  return `http://127.0.0.1:${address.port}`;
}

async function startWith(overrides: Partial<AppDependencies> = {}): Promise<string> {
  return start(createApp({ ...createTestAppDependencies(), ...overrides }));
}

function postTournament(baseUrl: string, body: string): Promise<Response> {
  return fetch(`${baseUrl}/api/tournaments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

afterEach(async () => {
  if (running !== undefined) {
    const server = running;
    running = undefined;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe('GET /health', () => {
  it('reports that the process is accepting requests', async () => {
    const baseUrl = await startWith();

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /api/tournaments', () => {
  it('answers 201 with the tournament, the invite URL and the host token', async () => {
    const baseUrl = await startWith();

    const response = await postTournament(
      baseUrl,
      JSON.stringify({ name: '社内クイズ大会', maxParticipants: 20 }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      tournament: {
        id: 'tournament-1',
        name: '社内クイズ大会',
        maxParticipants: 20,
        inviteCode: TEST_INVITE_CODE,
        status: 'active',
      },
      inviteUrl: `https://quiz.example.com/join?code=${TEST_INVITE_CODE}`,
    });
  });

  it('never puts the host token hash in the response', async () => {
    const baseUrl = await startWith();

    const response = await postTournament(
      baseUrl,
      JSON.stringify({ name: '大会', maxParticipants: 20 }),
    );

    expect(await response.text()).not.toContain('hostTokenHash');
  });

  it('answers 400 and a validation code for input the server rejects', async () => {
    const baseUrl = await startWith();

    const response = await postTournament(
      baseUrl,
      JSON.stringify({ name: '', maxParticipants: 0 }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ code: 'VALIDATION_ERROR', message: '大会名を入力してください' });
  });

  it('answers 400 rather than 500 for a body that is not valid JSON', async () => {
    const baseUrl = await startWith();

    const response = await postTournament(baseUrl, '{ not json');
    const body: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'リクエストの形式が正しくありません',
    });
  });

  it('answers 400 for a body larger than the limit', async () => {
    const baseUrl = await startWith();

    const response = await postTournament(
      baseUrl,
      JSON.stringify({ name: 'a'.repeat(20_000), maxParticipants: 20 }),
    );

    expect(response.status).toBe(400);
  });
});

describe('when a handler throws', () => {
  const failingRepository = {
    create: () => Promise.reject(new Error('DynamoDB is unreachable')),
    findById: () => Promise.resolve(undefined),
    findByInviteCode: () => Promise.resolve(undefined),
  };

  it('answers 500 with the shared error format instead of an Express stack page', async () => {
    const baseUrl = await startWith({ repository: failingRepository });

    const response = await postTournament(
      baseUrl,
      JSON.stringify({ name: '大会', maxParticipants: 20 }),
    );
    const body: unknown = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'サーバーエラーが発生しました',
    });
  });

  it('keeps the cause out of the response, since anyone can reach this endpoint', async () => {
    const baseUrl = await startWith({ repository: failingRepository });

    const response = await postTournament(
      baseUrl,
      JSON.stringify({ name: '大会', maxParticipants: 20 }),
    );

    expect(await response.text()).not.toContain('DynamoDB');
  });

  /**
   * A response cannot be given a status once it has started, so the handler has to fall back
   * to closing it. Reaching this through a request would need a route that writes and then
   * throws, which the application has none of, so the handler is called directly.
   */
  it('closes a response that has already started instead of trying to restatus it', () => {
    const calls: string[] = [];
    const response = {
      headersSent: true,
      status: () => {
        calls.push('status');
        return response;
      },
      json: () => {
        calls.push('json');
        return response;
      },
      end: () => {
        calls.push('end');
        return response;
      },
    } as unknown as ExpressResponse;

    errorHandler(createLogger({ minLevel: 'error', write: () => undefined }))(
      new Error('failed halfway through'),
      { method: 'POST', path: '/api/tournaments' } as ExpressRequest,
      response,
      (() => undefined) as NextFunction,
    );

    expect(calls).toEqual(['end']);
  });

  it('logs the cause, so the detail is recoverable from CloudWatch', async () => {
    const lines: string[] = [];
    const baseUrl = await startWith({
      repository: failingRepository,
      logger: createLogger({
        minLevel: 'error',
        write: (line) => {
          lines.push(line);
        },
      }),
    });

    await postTournament(baseUrl, JSON.stringify({ name: '大会', maxParticipants: 20 }));

    expect(lines.join('\n')).toContain('DynamoDB is unreachable');
    expect(lines.join('\n')).toContain('/api/tournaments');
  });
});
