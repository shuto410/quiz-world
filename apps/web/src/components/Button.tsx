/**
 * Primary action control shared by forms and room screens.
 *
 * Thin on purpose: it exists so every screen agrees on disabled / busy styling, not to
 * grow a variant matrix. Call sites pass ordinary button attributes.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Shows a busy label and blocks further clicks while an async action is in flight. */
  busy?: boolean;
};

export function Button({
  children,
  busy = false,
  disabled,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={['qw-button', className].filter(Boolean).join(' ')}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy}
      {...rest}
    >
      {busy ? '処理中…' : children}
    </button>
  );
}
