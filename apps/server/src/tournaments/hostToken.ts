/**
 * Issuing and hashing the host token.
 *
 * The token is the entire proof that someone is the host of a tournament. It is returned once
 * in the creation response, kept by the host's browser, and never stored in a recoverable
 * form: the table holds only a SHA-256 hash. Losing the token therefore means going through
 * the host takeover flow rather than asking the server to send it again.
 *
 * Plain SHA-256 is the right choice here, even though hashing a password this way would not
 * be. A password hash is deliberately slow because passwords are guessable and an attacker
 * with the hashes will try billions of candidates. This token is 256 bits from a CSPRNG, so
 * there is nothing to guess and no dictionary to try; the hash exists only so that a leaked
 * database dump does not hand over control of every tournament.
 */

import { createHash } from 'node:crypto';
import type { RandomBytes } from '@quiz-world/shared';

/** 256 bits, matching the digest it is hashed into. */
export const HOST_TOKEN_BYTES = 32;

/**
 * Produces a token to hand to the host.
 *
 * base64url keeps it URL- and JSON-safe, and shorter than hex, so it survives being pasted
 * around by hand.
 */
export function generateHostToken(randomBytes: RandomBytes): string {
  const bytes = randomBytes(HOST_TOKEN_BYTES);

  if (bytes.length !== HOST_TOKEN_BYTES) {
    throw new Error(`random source returned ${bytes.length} bytes, expected ${HOST_TOKEN_BYTES}`);
  }

  return Buffer.from(bytes).toString('base64url');
}

/** Produces the value stored in `TournamentRecord.hostTokenHash`. */
export function hashHostToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
