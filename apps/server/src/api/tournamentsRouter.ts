/**
 * The `/api/tournaments` routes.
 *
 * The handlers do no work of their own beyond translating between HTTP and the use cases:
 * they hand the raw input over, and turn the outcome into a status code. Validation, invite
 * code allocation, token issuing and the public-field projection all live in the use cases,
 * so they can be tested without a server.
 *
 * Unexpected failures are not caught here. Express 5 forwards a rejected promise from a
 * handler to the error middleware, which is where they become a 500 and a log line.
 */

import { Router } from 'express';
import { sendApiError } from './errors';
import type { CreateTournamentDependencies } from '../tournaments/createTournament';
import { createTournament } from '../tournaments/createTournament';
import { resolveInviteCode } from '../tournaments/resolveInviteCode';

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

  router.get('/by-invite-code/:code', async (request, response) => {
    const outcome = await resolveInviteCode(dependencies, request.params['code']);

    if (!outcome.ok) {
      sendApiError(response, outcome.code, outcome.message);
      return;
    }

    response.json(outcome.response);
  });

  return router;
}
