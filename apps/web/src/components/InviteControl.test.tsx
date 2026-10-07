/** @vitest-environment jsdom
 * The code is shown once and both it and the join URL are one press from the clipboard.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InviteControl } from './InviteControl';
import { ToastProvider } from './Toast';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show(writeText?: (text: string) => Promise<void>) {
  vi.stubGlobal('navigator', writeText ? { clipboard: { writeText } } : {});
  render(
    <ToastProvider>
      <InviteControl inviteCode="AB23CD45" inviteUrl="https://quiz.example/join?code=AB23CD45" />
    </ToastProvider>,
  );
}

it('prints the code once and never the URL', () => {
  show();
  expect(screen.getAllByText('AB23CD45')).toHaveLength(1);
  expect(screen.queryByText(/quiz\.example/)).toBeNull();
});

it('copies the code from the code itself and the URL from its button', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  show(writeText);
  fireEvent.click(screen.getByRole('button', { name: '招待コード AB23CD45 をコピー' }));
  expect(writeText).toHaveBeenLastCalledWith('AB23CD45');
  expect(await screen.findByText('招待コードをコピーしました')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'URLをコピー' }));
  expect(writeText).toHaveBeenLastCalledWith('https://quiz.example/join?code=AB23CD45');
  expect(await screen.findByText('招待URLをコピーしました')).toBeTruthy();
});

it.each(['refused', 'unavailable'] as const)('reports a clipboard that is %s', async (mode) => {
  show(mode === 'refused' ? vi.fn().mockRejectedValue(new Error('denied')) : undefined);
  fireEvent.click(screen.getByRole('button', { name: 'URLをコピー' }));
  expect((await screen.findByRole('alert')).textContent).toBe('コピーに失敗しました');
});
