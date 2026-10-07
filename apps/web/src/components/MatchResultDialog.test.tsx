/** @vitest-environment jsdom
 * The popup offers the next match to the host only, and closing it is a local act.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ParticipantState } from '@quiz-world/shared';
import { afterEach, expect, it, vi } from 'vitest';
import { MatchResultDialog } from './MatchResultDialog';

afterEach(cleanup);

const seat = (id: string, name: string, score: number): ParticipantState => ({
  id,
  name,
  score,
  correctCount: score,
  wrongCount: 0,
  online: true,
  joinedAt: 1,
});
const participants = [seat('h', 'ホスト', 0), seat('a', '太郎', 3), seat('b', '花子', 1)];

function show(isHost: boolean, disabled = false) {
  const onNextMatch = vi.fn();
  render(
    <MatchResultDialog
      rules={{ type: 'points', correctPoints: 1, wrongPoints: 0 }}
      participants={participants}
      hostId="h"
      isHost={isHost}
      disabled={disabled}
      onNextMatch={onNextMatch}
    />,
  );
  return onNextMatch;
}

it('shows the standings of the match and lets the host start the next one', () => {
  const onNextMatch = show(true);
  const dialog = screen.getByRole('dialog', { name: '試合結果' });
  expect(dialog.textContent).toContain('太郎');
  expect(dialog.textContent).toContain('3点');
  expect(dialog.textContent).not.toContain('ホスト');
  fireEvent.click(screen.getByRole('button', { name: '次の試合へ' }));
  expect(onNextMatch).toHaveBeenCalledOnce();
});

it('gives participants no way to start the next match', () => {
  show(false);
  expect(screen.queryByRole('button', { name: '次の試合へ' })).toBeNull();
  expect(screen.getByText('ホストが次の試合を始めるまでお待ちください。')).toBeTruthy();
});

it('cannot start the next match while the connection is down', () => {
  show(true, true);
  expect(screen.getByRole('button', { name: '次の試合へ' }).matches(':disabled')).toBe(true);
});

it.each(['button', 'escape'] as const)('closes locally by %s without calling the server', (how) => {
  const onNextMatch = show(true);
  if (how === 'button') fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
  else fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onNextMatch).not.toHaveBeenCalled();
});
