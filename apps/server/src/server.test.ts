/**
 * Tests for the HTTP and Socket.io wiring.
 *
 * These run a real server on an ephemeral port and talk to it over the network. A faked
 * Express or Socket.io would prove the modules were called, which is not the question; the
 * question is whether a browser reaching this process gets a health response and a working
 * WebSocket, and only an actual connection answers that.
 */

import type { Server as HttpServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { createRoomRegistry } from './rooms/roomRegistry';
import { createServer, listen, shutdown, type CreatedServer } from './server';
import { createTestAppDependencies } from './testing/appDependencies';

let running: CreatedServer | undefined;
let client: Socket | undefined;

function boundPort(httpServer: HttpServer): number {
  const address = httpServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server is not listening on a TCP port');
  }
  return address.port;
}

/** Starts a server on a free port and returns it together with its base URL. */
async function startTestServer(): Promise<{ server: CreatedServer; baseUrl: string }> {
  const server = createServer({
    ...createTestAppDependencies(),
    registry: createRoomRegistry({ now: () => Date.now() }),
    newParticipantId: () => 'participant-test',
  });
  await listen(server.httpServer, 0);
  running = server;

  return { server, baseUrl: `http://127.0.0.1:${boundPort(server.httpServer)}` };
}

afterEach(async () => {
  client?.disconnect();
  client = undefined;
  if (running) {
    await shutdown(running);
    running = undefined;
  }
});

describe('createServer', () => {
  it('answers the load balancer health check', async () => {
    const { baseUrl } = await startTestServer();

    const response = await fetch(`${baseUrl}/health`);
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
  });

  it('accepts a socket connection on the same port', async () => {
    const { baseUrl } = await startTestServer();

    client = connect(baseUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve, reject) => {
      client?.once('connect', resolve);
      client?.once('connect_error', reject);
    });

    expect(client.connected).toBe(true);
  });

  it('stops accepting requests once it is shut down', async () => {
    const { server, baseUrl } = await startTestServer();

    await shutdown(server);
    running = undefined;

    await expect(fetch(`${baseUrl}/health`)).rejects.toThrow();
  });
});
