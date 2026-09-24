/** Checks the time-behind-first labels and bar lengths shown in the buzz order. */
import { describe, expect, it } from 'vitest';
import { BUZZ_GAP_BAR_MAX_MS, describeBuzzGaps } from './buzzGap';

describe('describeBuzzGaps', () => {
  it('labels the first buzz as first place and the rest by the gap to it', () => {
    const gaps = describeBuzzGaps([
      { participantId: 'a', receivedAt: 10_000 },
      { participantId: 'b', receivedAt: 10_340 },
      { participantId: 'c', receivedAt: 11_470 },
    ]);
    expect(gaps.map((gap) => gap.label)).toEqual(['1着', '+0.34秒', '+1.47秒']);
    expect(gaps.map((gap) => gap.gapMs)).toEqual([0, 340, 1_470]);
  });

  it('shows simultaneous server receipt as a zero gap rather than hiding it', () => {
    const gaps = describeBuzzGaps([
      { participantId: 'a', receivedAt: 5_000 },
      { participantId: 'b', receivedAt: 5_000 },
    ]);
    expect(gaps[1]?.label).toBe('+0.00秒');
  });

  it('never shows a negative gap if clocks were adjusted between receipts', () => {
    const gaps = describeBuzzGaps([
      { participantId: 'a', receivedAt: 5_000 },
      { participantId: 'b', receivedAt: 4_900 },
    ]);
    expect(gaps[1]?.gapMs).toBe(0);
  });

  it('scales the bar to the fixed range and caps it at the full width', () => {
    const gaps = describeBuzzGaps([
      { participantId: 'a', receivedAt: 0 },
      { participantId: 'b', receivedAt: BUZZ_GAP_BAR_MAX_MS / 2 },
      { participantId: 'c', receivedAt: BUZZ_GAP_BAR_MAX_MS * 3 },
    ]);
    expect(gaps.map((gap) => gap.barRatio)).toEqual([0, 0.5, 1]);
  });

  it('returns nothing for an empty order', () => {
    expect(describeBuzzGaps([])).toEqual([]);
  });
});
