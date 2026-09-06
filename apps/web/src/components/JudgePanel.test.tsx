/**
 * @vitest-environment jsdom
 *
 * Tests for the host's judgement control.
 *
 * A judgement cannot be undone once it reaches the server, so what is worth pinning here is
 * everything that stops one from leaving by accident: no submission before a verdict is
 * chosen, no submission with an unusable score, and no "next responder" when the queue is
 * empty. The rest checks that the three buttons send the action they are labelled with.
 */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JudgePanel } from './JudgePanel';

afterEach(() => {
  cleanup();
});

function renderPanel(overrides: Partial<Parameters<typeof JudgePanel>[0]> = {}) {
  const onJudge = vi.fn();
  render(<JudgePanel responderName="太郎" hasNextResponder onJudge={onJudge} {...overrides} />);
  return onJudge;
}

describe('JudgePanel', () => {
  it('cannot be submitted before a verdict is chosen', async () => {
    const user = userEvent.setup();
    const onJudge = renderPanel();

    const confirm = screen.getByRole('button', { name: '結果を表示' });
    expect(confirm).toHaveProperty('disabled', true);
    await user.click(confirm);

    expect(onJudge).not.toHaveBeenCalled();
    expect(screen.getByText('正誤を選ぶと確定できます')).toBeTruthy();
  });

  it('fills in one point for a correct answer and sends it with the chosen action', async () => {
    const user = userEvent.setup();
    const onJudge = renderPanel();

    await user.click(screen.getByRole('button', { name: '正解' }));
    expect(screen.getByLabelText('得点')).toHaveProperty('value', '1');

    await user.click(screen.getByRole('button', { name: '結果を表示' }));

    expect(onJudge).toHaveBeenCalledWith({
      isCorrect: true,
      scoreDelta: 1,
      nextAction: 'showResult',
    });
  });

  it('fills in no points for a wrong answer, leaving a deduction to the host', async () => {
    const user = userEvent.setup();
    const onJudge = renderPanel();

    await user.click(screen.getByRole('button', { name: '不正解' }));
    expect(screen.getByLabelText('得点')).toHaveProperty('value', '0');

    await user.click(screen.getByRole('button', { name: '-1' }));
    await user.click(screen.getByRole('button', { name: '次の回答者へ' }));

    expect(onJudge).toHaveBeenCalledWith({
      isCorrect: false,
      scoreDelta: -1,
      nextAction: 'moveToNextResponder',
    });
  });

  it('sends resetToIdle when the host skips the result screen', async () => {
    const user = userEvent.setup();
    const onJudge = renderPanel();

    await user.click(screen.getByRole('button', { name: '正解' }));
    await user.click(screen.getByRole('button', { name: '結果を出さず早押しへ' }));

    expect(onJudge).toHaveBeenCalledWith({
      isCorrect: true,
      scoreDelta: 1,
      nextAction: 'resetToIdle',
    });
  });

  it('refuses a score the server would reject, without sending anything', async () => {
    const user = userEvent.setup();
    const onJudge = renderPanel();

    await user.click(screen.getByRole('button', { name: '正解' }));
    await user.clear(screen.getByLabelText('得点'));
    await user.click(screen.getByRole('button', { name: '結果を表示' }));

    expect(onJudge).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('得点を入力してください');
  });

  it('clears itself after a judgement so the next one starts from scratch', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: '正解' }));
    await user.click(screen.getByRole('button', { name: '結果を表示' }));

    expect(screen.getByLabelText('得点')).toHaveProperty('value', '');
    expect(screen.getByRole('button', { name: '結果を表示' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '正解' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('blocks moving on when nobody is queued and says why', async () => {
    const user = userEvent.setup();
    const onJudge = renderPanel({ hasNextResponder: false });

    await user.click(screen.getByRole('button', { name: '正解' }));

    expect(screen.getByRole('button', { name: '次の回答者へ' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '結果を表示' })).toHaveProperty('disabled', false);
    expect(
      screen.getByText('ほかに早押しした人がいないため、次の回答者へは進めません'),
    ).toBeTruthy();
    expect(onJudge).not.toHaveBeenCalled();
  });

  it('names the participant being judged', () => {
    renderPanel({ responderName: '花子' });

    expect(screen.getByText('花子')).toBeTruthy();
  });
});
