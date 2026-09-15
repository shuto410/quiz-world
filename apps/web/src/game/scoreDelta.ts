/** Displays configured and applied point changes with an explicit sign, including zero. */
/**
 * Formats a score change for display, always showing its direction.
 *
 * Zero is written as `±0` rather than `0`, so that "judged, no points" cannot be mistaken
 * for a missing value on the result screen.
 */
export function formatScoreDelta(scoreDelta: number): string {
  if (scoreDelta > 0) {
    return `+${scoreDelta}`;
  }
  if (scoreDelta < 0) {
    return `${scoreDelta}`;
  }
  return '±0';
}
