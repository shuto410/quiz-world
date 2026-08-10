/**
 * The tournament creation use case.
 *
 * Separated from the HTTP handler so that the parts worth testing carefully — rejecting bad
 * input, retrying a colliding invite code, returning the token exactly once — are tested
 * directly, and the route is left with nothing but status codes.
 *
 * The result is returned as a value rather than thrown, because a rejected request is an
 * ordinary outcome here and the caller has to turn it into a status code either way.
 * Failures the server cannot anticipate, such as DynamoDB being unreachable, are still
 * thrown and handled once by the error middleware.
 */

import type {
  ApiErrorCode,
  CreateTournamentResponse,
  RandomBytes,
  TournamentRecord,
} from '@quiz-world/shared';
import {
  generateInviteCode,
  validateMaxParticipants,
  validateTournamentName,
} from '@quiz-world/shared';
import { isRecord } from '../guards';
import { generateHostToken, hashHostToken } from './hostToken';
import { toTournament } from './record';
import type { TournamentRepository } from './repository';

export type CreateTournamentDependencies = {
  repository: TournamentRepository;
  randomBytes: RandomBytes;
  /** Injected rather than called directly so that tests can pin the id in assertions. */
  newTournamentId: () => string;
  now: () => number;
  /** Already free of a trailing slash; see `ServerConfig.publicBaseUrl`. */
  publicBaseUrl: string;
};

export type CreateTournamentOutcome =
  | { ok: true; response: CreateTournamentResponse }
  | { ok: false; code: ApiErrorCode; message: string };

/**
 * How many codes to try before giving up.
 *
 * With a 32-character alphabet and eight characters there are about 1.1 x 10^12 codes, so a
 * collision needs a table with millions of live tournaments. The retry is here because the
 * cost is one query, not because it is expected to run.
 */
const INVITE_CODE_ATTEMPTS = 5;

export async function createTournament(
  dependencies: CreateTournamentDependencies,
  body: unknown,
): Promise<CreateTournamentOutcome> {
  const { repository, randomBytes, newTournamentId, now, publicBaseUrl } = dependencies;

  if (!isRecord(body)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'リクエストの形式が正しくありません' };
  }

  const name = validateTournamentName(body['name']);
  if (!name.ok) {
    return { ok: false, code: 'VALIDATION_ERROR', message: name.message };
  }

  const maxParticipants = validateMaxParticipants(body['maxParticipants']);
  if (!maxParticipants.ok) {
    return { ok: false, code: 'VALIDATION_ERROR', message: maxParticipants.message };
  }

  const inviteCode = await allocateInviteCode(repository, randomBytes);
  if (inviteCode === undefined) {
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: '招待コードを発行できませんでした。時間をおいて再度お試しください',
    };
  }

  const hostToken = generateHostToken(randomBytes);
  const timestamp = now();

  const record: TournamentRecord = {
    id: newTournamentId(),
    name: name.value,
    maxParticipants: maxParticipants.value,
    inviteCode,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    hostTokenHash: hashHostToken(hostToken),
  };

  await repository.create(record);

  return {
    ok: true,
    response: {
      tournament: toTournament(record),
      inviteUrl: buildInviteUrl(publicBaseUrl, inviteCode),
      hostToken,
    },
  };
}

/**
 * Builds the link the host shares.
 *
 * The code is a query parameter so that `/join` serves both entry points: with a code it goes
 * straight to the name form, without one it shows the field for typing a code by hand.
 */
export function buildInviteUrl(publicBaseUrl: string, inviteCode: string): string {
  return `${publicBaseUrl}/join?code=${encodeURIComponent(inviteCode)}`;
}

async function allocateInviteCode(
  repository: TournamentRepository,
  randomBytes: RandomBytes,
): Promise<string | undefined> {
  for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt += 1) {
    const candidate = generateInviteCode(randomBytes);

    if ((await repository.findByInviteCode(candidate)) === undefined) {
      return candidate;
    }
  }

  return undefined;
}
