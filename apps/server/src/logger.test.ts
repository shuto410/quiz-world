/**
 * Tests for the structured logger.
 *
 * Each line has to be valid JSON on its own, because that is the contract CloudWatch Logs
 * Insights relies on. The awkward cases are the ones worth covering: an Error, which
 * `JSON.stringify` would otherwise reduce to `{}`, and a value that cannot be serialised at
 * all, which must not be allowed to take the process down from inside a log call.
 */

import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './logger';

function createSink(): { lines: string[]; write: (line: string) => void } {
  const lines: string[] = [];
  return {
    lines,
    write: (line) => {
      lines.push(line);
    },
  };
}

function onlyLine(lines: readonly string[]): Record<string, unknown> {
  const [line] = lines;
  if (line === undefined) {
    throw new Error('expected exactly one line to be written');
  }
  expect(lines).toHaveLength(1);

  const parsed: unknown = JSON.parse(line);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`expected a JSON object, received ${line}`);
  }
  return parsed as Record<string, unknown>;
}

const fixedClock = () => new Date('2026-08-01T09:00:00.000Z');

describe('createLogger', () => {
  it('writes one JSON object carrying the level, time and message', () => {
    const sink = createSink();
    const logger = createLogger({ write: sink.write, now: fixedClock });

    logger.info('server listening', { port: 3001 });

    expect(onlyLine(sink.lines)).toEqual({
      level: 'info',
      time: '2026-08-01T09:00:00.000Z',
      message: 'server listening',
      port: 3001,
    });
  });

  it('writes to stdout with a trailing newline when no sink is given', () => {
    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      if (typeof chunk === 'string') {
        chunks.push(chunk);
      }
      return true;
    });

    createLogger({ now: fixedClock }).info('to stdout');
    spy.mockRestore();

    expect(chunks).toEqual([
      `${JSON.stringify({
        level: 'info',
        time: '2026-08-01T09:00:00.000Z',
        message: 'to stdout',
      })}\n`,
    ]);
  });

  it('drops debug lines at the default level', () => {
    const sink = createSink();

    createLogger({ write: sink.write }).debug('noisy detail');

    expect(sink.lines).toEqual([]);
  });

  it.each([
    { minLevel: 'debug', level: 'debug', written: true },
    { minLevel: 'info', level: 'debug', written: false },
    { minLevel: 'info', level: 'info', written: true },
    { minLevel: 'warn', level: 'info', written: false },
    { minLevel: 'error', level: 'warn', written: false },
    { minLevel: 'error', level: 'error', written: true },
  ] as const)(
    'at minLevel $minLevel, writing $level produces a line: $written',
    ({ minLevel, level, written }) => {
      const sink = createSink();

      createLogger({ write: sink.write, minLevel, now: fixedClock })[level]('a line');

      expect(sink.lines).toHaveLength(written ? 1 : 0);
    },
  );

  it('attaches the bound fields of a child to every line', () => {
    const sink = createSink();
    const logger = createLogger({ write: sink.write, now: fixedClock });

    logger.child({ tournamentId: 'tournament-1' }).warn('buzz rejected', { reason: 'paused' });

    expect(onlyLine(sink.lines)).toEqual({
      level: 'warn',
      time: '2026-08-01T09:00:00.000Z',
      message: 'buzz rejected',
      tournamentId: 'tournament-1',
      reason: 'paused',
    });
  });

  it('accumulates fields across nested children', () => {
    const sink = createSink();
    const logger = createLogger({ write: sink.write, now: fixedClock });

    logger
      .child({ tournamentId: 'tournament-1' })
      .child({ participantId: 'participant-2' })
      .info('joined');

    expect(onlyLine(sink.lines)).toMatchObject({
      tournamentId: 'tournament-1',
      participantId: 'participant-2',
    });
  });

  it('lets a per-call field override a bound one', () => {
    const sink = createSink();
    const logger = createLogger({ write: sink.write, now: fixedClock });

    logger.child({ tournamentId: 'tournament-1' }).info('moved', {
      tournamentId: 'tournament-2',
    });

    expect(onlyLine(sink.lines)['tournamentId']).toBe('tournament-2');
  });

  it('unpacks an Error, which JSON.stringify would otherwise flatten to {}', () => {
    const sink = createSink();
    const logger = createLogger({ write: sink.write, now: fixedClock });

    logger.error('snapshot write failed', { error: new Error('throttled') });

    expect(onlyLine(sink.lines)['error']).toMatchObject({
      name: 'Error',
      message: 'throttled',
    });
  });

  it('degrades instead of throwing when a field cannot be serialised', () => {
    const sink = createSink();
    const logger = createLogger({ write: sink.write, now: fixedClock });
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    expect(() => {
      logger.error('unexpected value', { circular });
    }).not.toThrow();

    expect(onlyLine(sink.lines)).toEqual({
      level: 'error',
      message: 'unexpected value',
      error: 'log fields could not be serialised',
    });
  });
});
