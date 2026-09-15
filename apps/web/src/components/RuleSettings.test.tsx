/** @vitest-environment jsdom */
/** Rule drafts must be explicitly applied, remain separate from published rules, and lock after play. */
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import {
  DEFAULT_GAME_RULES,
  SEVEN_MARU_THREE_BATSU,
  type RoomStateEvent,
} from '@quiz-world/shared';
import { RuleSettings } from './RuleSettings';
afterEach(cleanup);
const roomState: RoomStateEvent = {
  tournamentId: 't',
  hostId: 'h',
  hostOnline: true,
  status: 'idle',
  updatedAt: 0,
  rules: DEFAULT_GAME_RULES,
  buzzOrder: [],
  participants: [],
};
function setup(overrides: Partial<Parameters<typeof RuleSettings>[0]['connection']> = {}) {
  const updateRules = vi.fn();
  const connection = {
    roomState,
    status: 'joined' as const,
    participantId: 'h',
    roomClosed: false,
    updateRules,
    ...overrides,
  };
  const rendered = render(<RuleSettings connection={connection} />);
  fireEvent.click(screen.getByText('試合ルール'));
  return {
    connection,
    updateRules,
    refresh: () => rendered.rerender(<RuleSettings connection={connection} />),
  };
}
it('applies the 7○3× preset and shows the server-confirmed rule', async () => {
  const user = userEvent.setup();
  const { connection, updateRules, refresh } = setup();
  await user.click(screen.getByRole('button', { name: '7○3×' }));
  expect(updateRules).not.toHaveBeenCalled();
  expect(screen.getByLabelText('勝ち抜けの正解数（○）')).toHaveProperty('value', '7');
  expect(screen.getByLabelText('失格の誤答数（×）')).toHaveProperty('value', '3');
  await user.click(screen.getByRole('button', { name: 'ルールを適用' }));
  expect(updateRules).toHaveBeenCalledExactlyOnceWith(SEVEN_MARU_THREE_BATSU);
  connection.roomState = { ...roomState, rules: SEVEN_MARU_THREE_BATSU };
  refresh();
  expect(screen.getByText('7○3× · 7正解で勝ち抜け / 3誤答で失格')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'ルールを適用' })).toHaveProperty('disabled', true);
});
it('sends customized counts and deductions as numbers', async () => {
  const user = userEvent.setup();
  const { updateRules } = setup();
  await user.clear(screen.getByLabelText('不正解時の点数'));
  await user.type(screen.getByLabelText('不正解時の点数'), '-2');
  await user.click(screen.getByRole('button', { name: 'ルールを適用' }));
  expect(updateRules).toHaveBeenLastCalledWith({
    type: 'points',
    correctPoints: 1,
    wrongPoints: -2,
  });
  await user.click(screen.getByRole('button', { name: 'n○m×' }));
  await user.clear(screen.getByLabelText('勝ち抜けの正解数（○）'));
  await user.type(screen.getByLabelText('勝ち抜けの正解数（○）'), '5');
  await user.click(screen.getByRole('button', { name: 'ルールを適用' }));
  expect(updateRules).toHaveBeenLastCalledWith({
    type: 'maruBatsu',
    correctTarget: 5,
    wrongLimit: 3,
  });
});
it.each(['participant', 'judged', 'connecting', 'answering'] as const)(
  'prevents rule edits when %s',
  (mode) => {
    setup({
      participantId: mode === 'participant' ? 'p' : 'h',
      status: mode === 'connecting' ? 'connecting' : 'joined',
      roomState: {
        ...roomState,
        status: mode === 'answering' ? 'answering' : 'idle',
        participants:
          mode === 'judged'
            ? [
                {
                  id: 'a',
                  name: 'A',
                  score: 0,
                  correctCount: 0,
                  wrongCount: 1,
                  online: true,
                  joinedAt: 1,
                },
              ]
            : [],
      },
    });
    const apply = screen.queryByRole('button', { name: 'ルールを適用' });
    expect(apply === null || apply.matches(':disabled')).toBe(true);
  },
);
