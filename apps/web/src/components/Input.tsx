/**
 * Labelled text field used by every form in the app.
 *
 * The error message slot is what keeps validation copy next to the field that failed,
 * matching the shared validators' Japanese messages from `packages/shared`.
 */

import type { InputHTMLAttributes, ReactNode } from 'react';
import './Input.css';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: ReactNode;
  /** Shown under the field when validation failed. */
  error?: string | undefined;
};

export function Input({ id, label, error, className, ...rest }: InputProps) {
  const errorId = `${id}-error`;

  return (
    <label className={['qw-input', className].filter(Boolean).join(' ')} htmlFor={id}>
      <span className="qw-input__label">{label}</span>
      <input
        id={id}
        className="qw-input__control"
        aria-invalid={error !== undefined || undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        {...rest}
      />
      {error !== undefined ? (
        <span id={errorId} className="qw-input__error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
