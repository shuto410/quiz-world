/**
 * Thin HTTP client for the two tournament REST endpoints.
 *
 * Same-origin only: Vite proxies `/api` in development and CloudFront does in production,
 * so this module never embeds a host name.
 */

import type {
  ApiErrorResponse,
  CreateTournamentRequest,
  CreateTournamentResponse,
  ResolveInviteCodeResponse,
} from '@quiz-world/shared';

export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; status: number; code: string; message: string };

async function readError(response: Response): Promise<ApiResult<never>> {
  const body: unknown = await response.json().catch(() => undefined);
  if (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    'message' in body &&
    typeof (body as ApiErrorResponse).code === 'string' &&
    typeof (body as ApiErrorResponse).message === 'string'
  ) {
    return {
      ok: false,
      status: response.status,
      code: (body as ApiErrorResponse).code,
      message: (body as ApiErrorResponse).message,
    };
  }

  return {
    ok: false,
    status: response.status,
    code: 'INTERNAL_ERROR',
    message: 'サーバーエラーが発生しました',
  };
}

/** `POST /api/tournaments` — returns the host token exactly once. */
export async function createTournament(
  request: CreateTournamentRequest,
): Promise<ApiResult<CreateTournamentResponse>> {
  try {
    const response = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return readError(response);
    }

    const value = (await response.json()) as CreateTournamentResponse;
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      status: 0,
      code: 'INTERNAL_ERROR',
      message: 'サーバーに接続できませんでした',
    };
  }
}

/** `GET /api/tournaments/by-invite-code/:code`. */
export async function resolveInviteCode(
  code: string,
): Promise<ApiResult<ResolveInviteCodeResponse>> {
  try {
    const response = await fetch(`/api/tournaments/by-invite-code/${encodeURIComponent(code)}`);

    if (!response.ok) {
      return readError(response);
    }

    const value = (await response.json()) as ResolveInviteCodeResponse;
    return { ok: true, value };
  } catch {
    return {
      ok: false,
      status: 0,
      code: 'INTERNAL_ERROR',
      message: 'サーバーに接続できませんでした',
    };
  }
}
