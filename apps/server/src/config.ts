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
};

const DEFAULT_PORT = 3001;
const DEFAULT_LOG_LEVEL: LogLevel = 'info';

/** Environment as seen by the process. Narrowed to what this module reads. */
export type Environment = Record<string, string | undefined>;

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

export function loadConfig(env: Environment): ServerConfig {
  return {
    port: parsePort(env['PORT']),
    logLevel: parseLogLevel(env['LOG_LEVEL']),
  };
}
