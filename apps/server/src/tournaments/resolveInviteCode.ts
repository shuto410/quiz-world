/**
 * Looking a tournament up by invite code for the join screen.
 *
 * This is a public endpoint: anyone holding a code can ask what it resolves to. That is why
 * the response is built field by field from a short allow-list rather than by stripping
 * secrets from the stored record. Capacity is left out for the same reason the design leaves
 * it out of `canJoin` — it changes by the second, and the binding check is on the socket.
 *
 * A malformed code is rejected before the database is asked. Returning "not found" for a
 * seven-character code would tell a scanner which prefixes are warm.
 */

import type { ApiErrorCode, ResolveInviteCodeResponse } from '@quiz-world/shared';
import { validateInviteCode } from '@quiz-world/shared';
import type { TournamentRepository } from './repository';

export type ResolveInviteCodeDependencies = {
  repository: TournamentRepository;
};

export type ResolveInviteCodeOutcome =
  | { ok: true; response: ResolveInviteCodeResponse }
  | { ok: false; code: ApiErrorCode; message: string };

export async function resolveInviteCode(
  { repository }: ResolveInviteCodeDependencies,
  rawCode: unknown,
): Promise<ResolveInviteCodeOutcome> {
  const code = validateInviteCode(rawCode);
  if (!code.ok) {
    return { ok: false, code: 'VALIDATION_ERROR', message: code.message };
  }

  const record = await repository.findByInviteCode(code.value);
  if (record === undefined) {
    return { ok: false, code: 'TOURNAMENT_NOT_FOUND', message: '大会が見つかりません' };
  }

  return {
    ok: true,
    response: {
      tournamentId: record.id,
      name: record.name,
      status: record.status,
      // Status alone. Capacity is re-checked when the participant actually joins.
      canJoin: record.status === 'active',
    },
  };
}
