/**
 * Playwright configuration for the browser end-to-end tests in `e2e/`.
 *
 * These tests answer the one question the Vitest suites cannot: whether real browsers, the
 * React screens and the Socket.io server agree with each other. They are kept out of
 * `npm run check` so that the ordinary loop stays fast; run them with `npm run test:e2e`.
 *
 * Playwright starts the whole stack itself. The server runs against an in-process DynamoDB
 * (see `apps/server/src/testing/e2eServer.ts`), so no Docker is needed and every run begins
 * with an empty database. The ports differ from the development ones so that a run does not
 * collide with a `npm run dev` that is already open; an existing server is never reused,
 * because leftover rooms would make exact-score assertions meaningless.
 *
 * One worker, no parallelism: a scenario drives several browsers against one shared server,
 * and buzz order is exactly the kind of thing that must not depend on what else is running.
 */

import { env } from 'node:process';
import { defineConfig, devices } from '@playwright/test';

const serverPort = Number(env['E2E_SERVER_PORT'] ?? 3011);
const webPort = Number(env['E2E_WEB_PORT'] ?? 5183);
const serverUrl = `http://localhost:${serverPort}`;
const webUrl = `http://localhost:${webPort}`;
const isCi = env['CI'] !== undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: webUrl,
    locale: 'ja-JP',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'server',
      command: 'npm run e2e -w @quiz-world/server',
      url: `${serverUrl}/health`,
      reuseExistingServer: false,
      env: {
        PORT: String(serverPort),
        // Invite URLs must point at the origin the browsers are actually using.
        PUBLIC_BASE_URL: webUrl,
        LOG_LEVEL: 'warn',
      },
    },
    {
      name: 'web',
      command: `npm run dev -w @quiz-world/web -- --port ${webPort} --strictPort`,
      url: webUrl,
      reuseExistingServer: false,
      env: { DEV_PROXY_TARGET: serverUrl },
      // Vite reports every WebSocket that closes mid-handshake as a proxy error, which is what
      // StrictMode's double mount and a closing browser both look like. That is a stack trace
      // per connection on a passing run, so it is dropped; `DEBUG=pw:webserver` shows it again.
      stderr: 'ignore',
    },
  ],
});
