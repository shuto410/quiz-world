/**
 * Tests for configuration loading.
 *
 * The behaviour that matters is the refusal. A malformed `PORT` that quietly falls back to
 * the default produces a server listening somewhere nobody expects, and the symptom shows up
 * much later as a failing health check. The same reasoning applies to `PUBLIC_BASE_URL`: a
 * value that is not a URL produces invite links nobody can open, and the host only finds out
 * once a participant tries.
 */

import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const defaults = {
  port: 3001,
  logLevel: 'info',
  awsRegion: 'ap-northeast-1',
  dynamoDbEndpoint: undefined,
  tournamentsTable: 'quiz-world-tournaments',
  publicBaseUrl: 'http://localhost:5173',
};

describe('loadConfig', () => {
  it('falls back to the development defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual(defaults);
  });

  it('treats an empty variable as unset', () => {
    expect(
      loadConfig({
        PORT: '',
        LOG_LEVEL: '',
        AWS_REGION: '',
        DYNAMODB_ENDPOINT: '',
        TOURNAMENTS_TABLE: '',
        PUBLIC_BASE_URL: '',
      }),
    ).toEqual(defaults);
  });

  it('reads the values that were set', () => {
    expect(
      loadConfig({
        PORT: '8080',
        LOG_LEVEL: 'debug',
        AWS_REGION: 'us-east-1',
        DYNAMODB_ENDPOINT: 'http://localhost:8000',
        TOURNAMENTS_TABLE: 'staging-tournaments',
        PUBLIC_BASE_URL: 'https://quiz.example.com',
      }),
    ).toEqual({
      port: 8080,
      logLevel: 'debug',
      awsRegion: 'us-east-1',
      dynamoDbEndpoint: 'http://localhost:8000',
      tournamentsTable: 'staging-tournaments',
      publicBaseUrl: 'https://quiz.example.com',
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

  describe('PUBLIC_BASE_URL', () => {
    it('drops a trailing slash, so callers can append a path directly', () => {
      expect(loadConfig({ PUBLIC_BASE_URL: 'https://quiz.example.com/' }).publicBaseUrl).toBe(
        'https://quiz.example.com',
      );
    });

    it('keeps a path prefix, since the SPA may not be served from the root', () => {
      expect(loadConfig({ PUBLIC_BASE_URL: 'https://example.com/quiz' }).publicBaseUrl).toBe(
        'https://example.com/quiz',
      );
    });

    it.each(['quiz.example.com', '/join', 'ftp://example.com', 'not a url'])(
      'refuses %s, which would produce invite links nobody can open',
      (value) => {
        expect(() => loadConfig({ PUBLIC_BASE_URL: value })).toThrow(/PUBLIC_BASE_URL/);
      },
    );
  });

  it('leaves the DynamoDB endpoint unset in AWS, which is what permits table creation locally', () => {
    expect(loadConfig({}).dynamoDbEndpoint).toBeUndefined();
  });
});
