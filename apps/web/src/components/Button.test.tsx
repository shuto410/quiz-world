/**
 * @vitest-environment jsdom
 *
 * Behaviour worth pinning on the shared button: the busy state both disables the control
 * and replaces the label, so a double-submit cannot sneak through while a request is out.
 */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

afterEach(() => {
  cleanup();
});

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>大会を作成</Button>);

    expect(screen.getByRole('button', { name: '大会を作成' })).toBeTruthy();
  });

  it('keeps its own class when the call site adds one', () => {
    render(<Button className="qw-judge__verdict">正解</Button>);

    expect(screen.getByRole('button', { name: '正解' }).className).toBe(
      'qw-button qw-judge__verdict',
    );
  });

  it('blocks clicks and swaps the label while busy', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button busy onClick={onClick}>
        大会を作成
      </Button>,
    );

    const button = screen.getByRole('button', { name: '処理中…' });
    expect(button).toHaveProperty('disabled', true);
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
