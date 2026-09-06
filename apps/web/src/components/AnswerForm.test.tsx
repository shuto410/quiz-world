/**
 * @vitest-environment jsdom
 *
 * Tests for the participant answer field.
 *
 * The behaviour worth pinning is what the form does before the socket is involved: it sends
 * the normalised text the server would store, refuses blank input with the shared validator's
 * copy, and stays inert for anyone without the answer right.
 */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnswerForm } from './AnswerForm';

afterEach(() => {
  cleanup();
});

describe('AnswerForm', () => {
  it('sends the trimmed answer and clears the field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AnswerForm disabled={false} onSubmit={onSubmit} />);

    const field = screen.getByLabelText('回答');
    await user.type(field, '  東京  ');
    await user.click(screen.getByRole('button', { name: '送信' }));

    expect(onSubmit).toHaveBeenCalledWith('東京');
    expect(field).toHaveProperty('value', '');
  });

  it('refuses blank input with the shared validation message', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AnswerForm disabled={false} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText('回答'), '   ');
    await user.click(screen.getByRole('button', { name: '送信' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('回答を入力してください');
  });

  it('stays visible but inert without the answer right', () => {
    render(<AnswerForm disabled onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('回答')).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: '送信' })).toHaveProperty('disabled', true);
  });
});
