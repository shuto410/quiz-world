/**
 * Smoke coverage for the socket error catalogue.
 */

import { SOCKET_ERROR_CODES } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { SOCKET_ERROR_MESSAGES, socketErrorMessage } from './errorMessages';

describe('socketErrorMessage', () => {
  it('covers every socket error code', () => {
    for (const code of SOCKET_ERROR_CODES) {
      expect(SOCKET_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
      expect(socketErrorMessage(code)).toBe(SOCKET_ERROR_MESSAGES[code]);
    }
  });
});
