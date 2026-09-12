/**
 * @vitest-environment jsdom
 *
 * The error slot is the contract with the shared validators: when a field fails, the same
 * Japanese message that the server would return is shown next to the input.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Input } from './Input';

afterEach(() => {
  cleanup();
});

describe('Input', () => {
  it('exposes a validation message to assistive tech when present', () => {
    render(<Input id="name" label="大会名" error="大会名を入力してください" />);

    const input = screen.getByRole('textbox', { name: /大会名/ });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('大会名を入力してください');
  });
});
