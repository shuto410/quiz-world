/** @vitest-environment jsdom */
/** Verdict buttons immediately submit a judgement without letting clients choose points. */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JudgePanel } from './JudgePanel';
afterEach(cleanup);
describe('JudgePanel', () => {
  it.each([
    ['正解', true],
    ['不正解', false],
  ] as const)('submits %s on one click', async (label, isCorrect) => {
    const onJudge = vi.fn();
    render(
      <JudgePanel
        responderName="太郎"
        rules={{ type: 'points', correctPoints: 2, wrongPoints: -1 }}
        onJudge={onJudge}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: label }));
    expect(onJudge).toHaveBeenCalledExactlyOnceWith({ isCorrect });
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button', { name: '結果を表示' })).toBeNull();
  });
  it('says a press is only a cue when nobody is waiting to be judged', () => {
    render(
      <JudgePanel
        rules={{ type: 'points', correctPoints: 2, wrongPoints: -1 }}
        onJudge={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '正解' }).textContent).toContain('演出のみ');
    expect(screen.getByRole('button', { name: '不正解' }).textContent).not.toContain('点');
    expect(screen.getByText('演出のみ（得点は変わりません）')).toBeTruthy();
  });
});
