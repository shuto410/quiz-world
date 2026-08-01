/**
 * The Express application.
 *
 * Only the health check lives here for now; the tournament endpoints arrive with the
 * DynamoDB repository. It is built by a factory rather than exported as a module-level
 * singleton so that tests can start an isolated instance on an ephemeral port.
 */

import express, { type Express } from 'express';

export function createApp(): Express {
  const app = express();

  /**
   * Target of the load balancer health check. It deliberately reports only that the process
   * is accepting requests: making it depend on DynamoDB would let a transient database
   * problem convince the balancer to kill a task that is still hosting live tournaments.
   */
  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  return app;
}
