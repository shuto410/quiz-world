/**
 * Tests for configuration loading.
 *
 * The behaviour that matters is the refusal. A malformed `PORT` that quietly falls back to
 * the default produces a server listening somewhere nobody expects, and the symptom shows up
 * much later as a failing health check.
 */

import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
  it('falls back to the development defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({ port: 3001, logLevel: 'info' });
  });

  it('treats an empty variable as unset', () => {
    expect(loadConfig({ PORT: '', LOG_LEVEL: '' })).toEqual({ port: 3001, logLevel: 'info' });
  });

  it('reads the values that were set', () => {
    expect(loadConfig({ PORT: '8080', LOG_LEVEL: 'debug' })).toEqual({
      port: 8080,
      logLevel: 'debug',
    });
  });

  it.each(['0', '65536', '80.5', 'http', '-1'])('refuses to start on PORT=%s', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/PORT/);
  });

  it.each(['1', '65535'])('accepts the boundary port %s', (port) => {
    expect(loadConfig({ PORT: port }).port).toBe(Number(port));
  });

  it('refuses an unknown log level', () => {
    expect(() => loadConfig({ LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });
});
