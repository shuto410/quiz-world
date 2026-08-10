/**
 * The Express application.
 *
 * It is built by a factory rather than exported as a module-level singleton so that tests can
 * start an isolated instance on an ephemeral port, and so that the dependencies a route needs
 * are handed to it instead of being imported from a global.
 *
 * Only the requests that have to happen before a socket connection exists are served here.
 * Everything during play goes over the socket.
 */

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { sendApiError } from './api/errors';
import { createTournamentsRouter } from './api/tournamentsRouter';
import { isRecord } from './guards';
import type { Logger } from './logger';
import type { CreateTournamentDependencies } from './tournaments/createTournament';

export type AppDependencies = CreateTournamentDependencies & {
  logger: Logger;
};

/**
 * Bodies here are two short fields. The limit is what stops an unauthenticated endpoint from
 * being handed a payload large enough to matter.
 */
const MAX_BODY_SIZE = '8kb';

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.use(express.json({ limit: MAX_BODY_SIZE }));

  /**
   * Target of the load balancer health check. It deliberately reports only that the process
   * is accepting requests: making it depend on DynamoDB would let a transient database
   * problem convince the balancer to kill a task that is still hosting live tournaments.
   */
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/tournaments', createTournamentsRouter(dependencies));

  app.use(errorHandler(dependencies.logger));

  return app;
}

/**
 * Turns anything a route threw into the API's error format.
 *
 * The message sent to the client is fixed. An exception's own message can name a table or
 * quote part of an item, and this endpoint is reachable by anyone; the detail belongs in the
 * log, which is correlated to the response by nothing more than the timestamp because the
 * MVP has no request ids yet.
 */
export function errorHandler(logger: Logger) {
  return (error: unknown, request: Request, response: Response, _next: NextFunction): void => {
    if (isBodyParserError(error)) {
      sendApiError(response, 'VALIDATION_ERROR', 'リクエストの形式が正しくありません');
      return;
    }

    logger.error('request failed', { method: request.method, path: request.path, error });

    // A handler that already started writing cannot be given a different status.
    if (response.headersSent) {
      response.end();
      return;
    }

    sendApiError(response, 'INTERNAL_ERROR', 'サーバーエラーが発生しました');
  };
}

/**
 * Recognises the failures raised by `express.json()`, such as malformed JSON or a body over
 * the size limit. Those are the caller's fault, so they must not be reported as a 500.
 */
function isBodyParserError(error: unknown): boolean {
  return (
    isRecord(error) && typeof error['type'] === 'string' && error['type'].startsWith('entity.')
  );
}
