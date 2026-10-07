/** @vitest-environment jsdom
 * A cue is shown and sounded exactly once, and never replayed from the past.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReceivedJudgeEffect } from '../hooks/useRoomSocket';
import { playJudgeSound } from '../sound/judgeSound';
import { JUDGE_EFFECT_MS, JudgeEffect } from './JudgeEffect';

vi.mock('../sound/judgeSound', () => ({
  playJudgeSound: vi.fn(),
  unlockJudgeSound: () => () => undefined,
}));
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const cue = (id: number, isCorrect: boolean): ReceivedJudgeEffect => ({
  id,
  isCorrect,
  receivedAt: Date.now(),
});

it('shows and sounds each cue once, including two identical cues in a row', () => {
  const first = cue(1, true);
  const view = render(<JudgeEffect effect={undefined} muted={false} />);
  expect(screen.queryByText('正解！')).toBeNull();
  view.rerender(<JudgeEffect effect={first} muted={false} />);
  expect(screen.getByText('正解！')).toBeTruthy();
  expect(playJudgeSound).toHaveBeenCalledExactlyOnceWith(true);
  // An unrelated re-render, such as a score broadcast, must not ring again.
  view.rerender(<JudgeEffect effect={first} muted={false} />);
  expect(playJudgeSound).toHaveBeenCalledTimes(1);
  view.rerender(<JudgeEffect effect={cue(2, true)} muted={false} />);
  expect(playJudgeSound).toHaveBeenCalledTimes(2);
  view.rerender(<JudgeEffect effect={cue(3, false)} muted={false} />);
  expect(screen.getByText('不正解')).toBeTruthy();
  expect(playJudgeSound).toHaveBeenLastCalledWith(false);
  act(() => {
    vi.advanceTimersByTime(JUDGE_EFFECT_MS);
  });
  expect(screen.queryByText('不正解')).toBeNull();
});

it('keeps the mark but stays silent when the viewer muted sound', () => {
  render(<JudgeEffect effect={cue(1, false)} muted />);
  expect(screen.getByText('不正解')).toBeTruthy();
  expect(playJudgeSound).not.toHaveBeenCalled();
});

it('does not replay a cue that is already old when the view mounts', () => {
  const old = cue(1, true);
  vi.advanceTimersByTime(5000);
  render(<JudgeEffect effect={old} muted={false} />);
  expect(screen.queryByText('正解！')).toBeNull();
  expect(playJudgeSound).not.toHaveBeenCalled();
});
