/**
 * Tests for host token issuing and hashing.
 *
 * The digest values are checked against fixed expectations rather than against a second call
 * to `createHash`, which would only prove the function calls itself the same way twice. The
 * expectations below are the published SHA-256 digests of their inputs, so a change in the
 * algorithm or the encoding fails here — and it has to, because a stored hash that no longer
 * matches locks every existing host out of their tournament.
 */

import { describe, expect, it } from 'vitest';
import { HOST_TOKEN_BYTES, generateHostToken, hashHostToken } from './hostToken';

/** Counts up so that every byte position is distinguishable in the encoded output. */
const sequentialBytes = (byteLength: number): Uint8Array =>
  Uint8Array.from({ length: byteLength }, (_value, index) => index);

describe('generateHostToken', () => {
  it('asks for 256 bits of randomness', () => {
    let requested = 0;

    generateHostToken((byteLength) => {
      requested = byteLength;
      return sequentialBytes(byteLength);
    });

    expect(requested).toBe(32);
    expect(HOST_TOKEN_BYTES).toBe(32);
  });

  it('encodes the bytes as base64url', () => {
    expect(generateHostToken(sequentialBytes)).toBe('AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8');
  });

  it('produces a token safe to put in a URL or a JSON body', () => {
    const token = generateHostToken((byteLength) =>
      Uint8Array.from({ length: byteLength }, (_value, index) => (index * 37) % 256),
    );

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('refuses a random source that returns the wrong number of bytes', () => {
    expect(() => generateHostToken(() => new Uint8Array(16))).toThrowError(
      'random source returned 16 bytes, expected 32',
    );
  });
});

describe('hashHostToken', () => {
  it('produces the SHA-256 digest in lower-case hex', () => {
    expect(hashHostToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes multi-byte characters as UTF-8', () => {
    expect(hashHostToken('あ')).toBe(
      'dc5a4d3d82f7e15792959dc661538ae0e541ce66494516f5c9cfd9cd3308494d',
    );
  });

  it('is deterministic, so a token issued today still matches tomorrow', () => {
    const token = generateHostToken(sequentialBytes);

    expect(hashHostToken(token)).toBe(hashHostToken(token));
  });

  it('gives different tokens different digests', () => {
    expect(hashHostToken('token-a')).not.toBe(hashHostToken('token-b'));
  });

  it('is not the token itself', () => {
    expect(hashHostToken('a-secret-token')).not.toContain('a-secret-token');
  });
});
