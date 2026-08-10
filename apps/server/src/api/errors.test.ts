/**
 * Tests for the API error format.
 *
 * The mapping is a lookup table, so the test is a tripwire rather than an exercise of logic:
 * it fails when a new error code is added without deciding on its status, which is the moment
 * that decision is cheapest to make.
 */

import { API_ERROR_CODES } from '@quiz-world/shared';
import { describe, expect, it } from 'vitest';
import { API_ERROR_STATUS } from './errors';

describe('API_ERROR_STATUS', () => {
  it('assigns a status to every error code the API can return', () => {
    expect(Object.keys(API_ERROR_STATUS).sort()).toEqual([...API_ERROR_CODES].sort());
  });

  it('reports client mistakes in the 4xx range and server ones in the 5xx range', () => {
    expect(API_ERROR_STATUS.VALIDATION_ERROR).toBe(400);
    expect(API_ERROR_STATUS.TOURNAMENT_NOT_FOUND).toBe(404);
    expect(API_ERROR_STATUS.TOURNAMENT_NOT_JOINABLE).toBe(409);
    expect(API_ERROR_STATUS.INTERNAL_ERROR).toBe(500);
  });
});
