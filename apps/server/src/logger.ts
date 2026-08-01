/**
 * Structured logging.
 *
 * Every line is a single JSON object written to stdout, because that is what CloudWatch
 * Logs Insights can query without a parsing rule. Getting this right at the start is cheap;
 * retrofitting it means losing the ability to answer questions about past incidents.
 *
 * `child()` exists so that a connection can attach its tournament and participant ids once
 * and have every later line carry them. Correlating a complaint like "my buzz did not
 * register" with server behaviour is only possible if the lines can be filtered down to that
 * one participant.
 *
 * Writing goes straight to `process.stdout` rather than through `console`, so that nothing
 * in the pipeline reformats or interleaves a partially written line.
 */

/** Severity of a log line, ordered from most to least verbose. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

/** Extra key-value pairs merged into the JSON line. */
export type LogFields = Record<string, unknown>;

export type Logger = {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
  /** Returns a logger that adds `fields` to every line it writes. */
  child: (fields: LogFields) => Logger;
};

export type LoggerOptions = {
  /** Lines below this level are dropped. */
  minLevel: LogLevel;
  /** Wall clock, injectable so that tests can assert on the timestamp. */
  now: () => Date;
  /** Sink for finished lines, injectable so that tests do not write to stdout. */
  write: (line: string) => void;
};

const defaultWrite = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/**
 * `JSON.stringify` turns an Error into `{}`, which loses exactly the information worth
 * logging, so errors are unpacked by hand.
 */
function replaceUnserializable(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

/**
 * A logger that throws would turn a recoverable problem into an outage, so a value that
 * cannot be serialised degrades to a line that at least keeps the message and the level.
 */
function serialize(line: Record<string, unknown>, level: LogLevel, message: string): string {
  try {
    return JSON.stringify(line, replaceUnserializable);
  } catch {
    return JSON.stringify({
      level,
      message,
      error: 'log fields could not be serialised',
    });
  }
}

export function createLogger(options: Partial<LoggerOptions> = {}): Logger {
  const now = options.now ?? (() => new Date());
  const write = options.write ?? defaultWrite;
  const threshold = LOG_LEVELS.indexOf(options.minLevel ?? 'info');

  const build = (boundFields: LogFields): Logger => {
    const log = (level: LogLevel, message: string, fields?: LogFields): void => {
      if (LOG_LEVELS.indexOf(level) < threshold) {
        return;
      }
      const line = { level, time: now().toISOString(), message, ...boundFields, ...fields };
      write(serialize(line, level, message));
    };

    return {
      debug: (message, fields) => {
        log('debug', message, fields);
      },
      info: (message, fields) => {
        log('info', message, fields);
      },
      warn: (message, fields) => {
        log('warn', message, fields);
      },
      error: (message, fields) => {
        log('error', message, fields);
      },
      child: (fields) => build({ ...boundFields, ...fields }),
    };
  };

  return build({});
}
