/**
 * @vitest-environment jsdom
 *
 * Covers the two jobs the toast layer has at this stage: surfacing a message for assistive
 * tech, and dismissing itself so the screen does not fill with stale notices.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, scheduleWithWindow, useToast } from './Toast';

afterEach(() => {
  cleanup();
});

function Probe({ message, tone }: { message: string; tone?: 'info' | 'error' }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message, tone)}>
      show
    </button>
  );
}

describe('ToastProvider', () => {
  it('announces an error toast as an alert', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider scheduleDismissal={() => () => undefined}>
        <Probe message="満員です" tone="error" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'show' }));

    expect(screen.getByRole('alert').textContent).toBe('満員です');
  });

  it('dismisses a toast after the scheduled delay', async () => {
    const user = userEvent.setup();
    let dismissScheduled: (() => void) | undefined;
    const scheduleDismissal = vi.fn((dismiss: () => void) => {
      dismissScheduled = dismiss;
      return () => undefined;
    });

    render(
      <ToastProvider scheduleDismissal={scheduleDismissal}>
        <Probe message="接続が切れました" />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'show' }));
    expect(screen.getByRole('status').textContent).toBe('接続が切れました');

    act(() => {
      dismissScheduled?.();
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('rejects useToast outside the provider', () => {
    expect(() => render(<Probe message="x" />)).toThrow(/ToastProvider/);
  });

  it('clears the window timer when the default scheduler is cancelled', () => {
    vi.useFakeTimers();
    const dismiss = vi.fn();

    try {
      const cancel = scheduleWithWindow(dismiss, 4_000);
      cancel();
      vi.advanceTimersByTime(4_000);
      expect(dismiss).not.toHaveBeenCalled();

      scheduleWithWindow(dismiss, 4_000);
      vi.advanceTimersByTime(4_000);
      expect(dismiss).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
