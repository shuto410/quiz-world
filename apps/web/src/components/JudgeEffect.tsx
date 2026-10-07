/**
 * The flourish everyone sees and hears when the host presses correct or wrong.
 *
 * It is driven by the server's cue, not by the room state, so it fires for a bare cue as well
 * as for a real verdict, and every screen in the room shows it together. The overlay ignores
 * the pointer and removes itself, so it can never sit between somebody and the buzzer.
 *
 * A cue is acted on once. One that is already old when this component mounts, such as after a
 * host takeover swaps the view, is left alone rather than replayed.
 */

import { useEffect, useState } from 'react';
import type { ReceivedJudgeEffect } from '../hooks/useRoomSocket';
import { playJudgeSound, unlockJudgeSound } from '../sound/judgeSound';
import './JudgeEffect.css';

/** How long the mark stays up. Matches the CSS animation. */
export const JUDGE_EFFECT_MS = 1400;
/** A cue older than this at mount belongs to a moment that has passed. */
const STALE_AFTER_MS = 1000;

export type JudgeEffectProps = {
  effect: ReceivedJudgeEffect | undefined;
  /** The viewer's own preference. Silences the sound only; the mark still shows. */
  muted: boolean;
};

export function JudgeEffect({ effect, muted }: JudgeEffectProps) {
  const [shown, setShown] = useState<ReceivedJudgeEffect>();
  useEffect(unlockJudgeSound, []);
  const id = effect?.id;
  useEffect(() => {
    if (effect === undefined || Date.now() - effect.receivedAt > STALE_AFTER_MS) return;
    setShown(effect);
    if (!muted) playJudgeSound(effect.isCorrect);
    const timer = window.setTimeout(() => {
      setShown(undefined);
    }, JUDGE_EFFECT_MS);
    return () => {
      window.clearTimeout(timer);
    };
    // Keyed on the cue alone: toggling mute or re-rendering must not replay it.
  }, [id]);

  if (shown === undefined) return null;
  return (
    <div
      key={shown.id}
      className="qw-judge-effect"
      data-verdict={shown.isCorrect ? 'correct' : 'wrong'}
      aria-hidden="true"
    >
      <div className="qw-judge-effect__mark">
        <span>{shown.isCorrect ? '○' : '×'}</span>
        <strong>{shown.isCorrect ? '正解！' : '不正解'}</strong>
      </div>
    </div>
  );
}
