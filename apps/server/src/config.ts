/**
 * Server configuration, read from the environment once at startup.
 *
 * Reading the environment happens here and nowhere else, so that the rest of the code takes
 * a plain object and stays testable without touching `process.env`.
 *
 * Bad values fail immediately rather than being silently replaced by a default. A server
 * that quietly listens on a port nobody expects is harder to diagnose than one that refuses
 * to start.
 */

import type { LogLevel } from './logger';
import { LOG_LEVELS } from './logger';

export type ServerConfig = {
  /** Port the HTTP and Socket.io server listens on. */
  port: number;
  logLevel: LogLevel;
  /**
   * Fixed to one region by design: buzz fairness assumes every participant reaches the same
   * process over comparable network paths.
   */
  awsRegion: string;
  /**
   * Set only when talking to DynamoDB Local. Its presence is also what permits the server to
   * create missing tables, so that a misconfigured production task can never do so.
   */
  dynamoDbEndpoint?: string;
  tournamentsTable: string;
  /** Short-lived recovery state, separate from durable tournament settings. */
  snapshotsTable: string;
  /**
   * Origin the SPA is served from, used to build invite URLs. Read from configuration rather
   * than hard-coded so that acquiring a domain later does not require a code change.
   *
   * Stored without a trailing slash, so callers can append a path directly.
   */
  publicBaseUrl: string;
};

const DEFAULT_PORT = 3001;
const DEFAULT_LOG_LEVEL: LogLevel = 'info';
const DEFAULT_AWS_REGION = 'ap-northeast-1';
const DEFAULT_TOURNAMENTS_TABLE = 'quiz-world-tournaments';
/** The Vite dev server, which proxies `/api` and `/socket.io` back to this process. */
const DEFAULT_PUBLIC_BASE_URL = 'http://localhost:5173';

/** Environment as seen by the process. Narrowed to what this module reads. */
export type Environment = Record<string, string | undefined>;

function optional(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, received ${value}`);
  }
  return port;
}

function parseLogLevel(value: string | undefined): LogLevel {
  if (value === undefined || value === '') {
    return DEFAULT_LOG_LEVEL;
  }

  const level = LOG_LEVELS.find((candidate) => candidate === value);
  if (level === undefined) {
    throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, received ${value}`);
  }
  return level;
}

function parseBaseUrl(value: string | undefined): string {
  const raw = optional(value) ?? DEFAULT_PUBLIC_BASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`PUBLIC_BASE_URL must be an absolute URL, received ${raw}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`PUBLIC_BASE_URL must use http or https, received ${raw}`);
  }

  return raw.replace(/\/+$/, '');
}

export function loadConfig(env: Environment): ServerConfig {
  return {
    port: parsePort(env['PORT']),
    logLevel: parseLogLevel(env['LOG_LEVEL']),
    awsRegion: optional(env['AWS_REGION']) ?? DEFAULT_AWS_REGION,
    dynamoDbEndpoint: optional(env['DYNAMODB_ENDPOINT']),
    tournamentsTable: optional(env['TOURNAMENTS_TABLE']) ?? DEFAULT_TOURNAMENTS_TABLE,
    snapshotsTable: optional(env['ROOM_SNAPSHOTS_TABLE']) ?? 'quiz-world-room-snapshots',
    publicBaseUrl: parseBaseUrl(env['PUBLIC_BASE_URL']),
  };
}
