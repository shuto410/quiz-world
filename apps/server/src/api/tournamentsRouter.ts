/**
 * The `/api/tournaments` routes.
 *
 * The handler does no work of its own beyond translating between HTTP and the use case: it
 * hands the raw body over, and turns the outcome into a status code. Validation, invite code
 * allocation and token issuing all live in `createTournament`, so they can be tested without
 * a server.
 *
 * Unexpected failures are not caught here. Express 5 forwards a rejected promise from a
 * handler to the error middleware, which is where they become a 500 and a log line.
 */

import { Router } from 'express';
import { sendApiError } from './errors';
import type { CreateTournamentDependencies } from '../tournaments/createTournament';
import { createTournament } from '../tournaments/createTournament';

export function createTournamentsRouter(dependencies: CreateTournamentDependencies): Router {
  const router = Router();

  router.post('/', async (request, response) => {
    const outcome = await createTournament(dependencies, request.body);

    if (!outcome.ok) {
      sendApiError(response, outcome.code, outcome.message);
      return;
    }

    // 201 with no Location header: the tournament is reached through the invite URL in the
    // body, not through a canonical resource path the client is expected to follow.
    response.status(201).json(outcome.response);
  });

  return router;
}
