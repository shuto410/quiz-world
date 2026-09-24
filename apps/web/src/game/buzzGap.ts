/**
 * Display-only gaps between each accepted buzz and the first one in the round.
 *
 * The order itself is the server's `buzzOrder` array and is never re-sorted here. The gap
 * uses the server's own receipt times (`receivedAt`), so it describes how far apart the
 * buzzes reached the server, not how fast anyone pressed; network delay is included.
 */
import type { BuzzEntry } from '@quiz-world/shared';

/** Gap that fills the whole bar; anything slower is drawn at full width. */
export const BUZZ_GAP_BAR_MAX_MS = 2_500;

/** What a buzz order row shows on its right-hand side. */
export type BuzzGap = {
  /** Milliseconds behind the first buzz, never negative. */
  gapMs: number;
  /** `1着` for the first buzz, otherwise `+0.34秒`. */
  label: string;
  /** Bar length from 0 to 1 over `BUZZ_GAP_BAR_MAX_MS`. */
  barRatio: number;
};

export function describeBuzzGaps(buzzOrder: readonly BuzzEntry[]): BuzzGap[] {
  const first = buzzOrder[0];
  if (first === undefined) return [];
  return buzzOrder.map((entry, index) => {
    const gapMs = Math.max(0, entry.receivedAt - first.receivedAt);
    return {
      gapMs,
      label: index === 0 ? '1着' : `+${(gapMs / 1000).toFixed(2)}秒`,
      barRatio: Math.min(1, gapMs / BUZZ_GAP_BAR_MAX_MS),
    };
  });
}
