/** @vitest-environment jsdom
 * Rename feedback follows acknowledgement rather than optimistic roster changes.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RenameForm } from './RenameForm';
import { ToastProvider } from './Toast';
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
afterEach(cleanup);
it('validates locally, retains rejected input, and only confirms an accepted rename', async () => {
  const rename = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const connection = {
    status: 'joined',
    roomClosed: false,
    renaming: false,
    rename,
    participantId: 'p',
    roomState: { participants: [{ id: 'p', name: '太郎' }] },
  } as unknown as UseRoomSocketResult;
  render(
    <ToastProvider>
      <RenameForm connection={connection} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: '表示名を変更' }));
  expect(screen.getByLabelText<HTMLInputElement>('新しい表示名').value).toBe('太郎');
  fireEvent.change(screen.getByLabelText('新しい表示名'), { target: { value: '  ' } });
  fireEvent.click(screen.getByRole('button', { name: '変更する' }));
  expect(rename).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toBe('表示名を入力してください');
  fireEvent.change(screen.getByLabelText('新しい表示名'), { target: { value: ' 次郎 ' } });
  fireEvent.click(screen.getByRole('button', { name: '変更する' }));
  await waitFor(() => expect(rename).toHaveBeenCalledWith('次郎'));
  expect(screen.queryByText('表示名を変更しました')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '変更する' }));
  await waitFor(() => expect(screen.getByText('表示名を変更しました')).toBeTruthy());
  expect(screen.queryByLabelText('新しい表示名')).toBeNull();
});
