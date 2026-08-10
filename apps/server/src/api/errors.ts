/**
 * The single error format of the HTTP API.
 *
 * Every non-2xx response has the same body, `{ code, message }`. The code is what the client
 * branches on and the message is what it shows, which keeps the client from having to parse
 * Japanese prose to work out what happened.
 *
 * The mapping from code to status lives here rather than at each call site so that a code can
 * never be returned with two different statuses depending on which handler produced it.
 */

import type { ApiErrorCode, ApiErrorResponse } from '@quiz-world/shared';
import type { Response } from 'express';

export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  TOURNAMENT_NOT_FOUND: 404,
  /** 409, not 403: the request was well formed and authorised, the tournament's state refused it. */
  TOURNAMENT_NOT_JOINABLE: 409,
  INTERNAL_ERROR: 500,
};

export function sendApiError(response: Response, code: ApiErrorCode, message: string): void {
  const body: ApiErrorResponse = { code, message };
  response.status(API_ERROR_STATUS[code]).json(body);
}
