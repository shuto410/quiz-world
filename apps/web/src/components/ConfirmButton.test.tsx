/**
 * @vitest-environment jsdom
 *
 * Tests for the two-step button used by the irreversible host actions.
 */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

afterEach(() => {
  cleanup();
});

function renderButton(onConfirm = vi.fn()) {
  render(
    <ConfirmButton
      label="大会終了"
      question="大会を終了しますか？"
      confirmLabel="終了する"
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
}

describe('ConfirmButton', () => {
  it('asks before doing anything', async () => {
    const user = userEvent.setup();
    const onConfirm = renderButton();

    await user.click(screen.getByRole('button', { name: '大会終了' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('大会を終了しますか？')).toBeTruthy();
  });

  it('fires once the confirmation is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = renderButton();

    await user.click(screen.getByRole('button', { name: '大会終了' }));
    await user.click(screen.getByRole('button', { name: '終了する' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Back to resting, so a stray second click cannot repeat the action.
    expect(screen.getByRole('button', { name: '大会終了' })).toBeTruthy();
  });

  it('backs out without firing', async () => {
    const user = userEvent.setup();
    const onConfirm = renderButton();

    await user.click(screen.getByRole('button', { name: '大会終了' }));
    await user.click(screen.getByRole('button', { name: 'やめる' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '大会終了' })).toBeTruthy();
  });
});
