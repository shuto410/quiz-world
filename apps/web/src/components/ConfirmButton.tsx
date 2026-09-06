/**
 * A button for actions that cannot be taken back, asking once before it fires.
 *
 * Ending a tournament and closing a room are both one click away from the ordinary controls
 * and neither has an undo: the first moves everyone to the final result, the second
 * disconnects them. The confirmation is inline rather than a browser dialog so that it can be
 * dismissed with a visible button and tested like any other markup.
 */

import { useState } from 'react';
import { Button } from './Button';
import './ConfirmButton.css';

export type ConfirmButtonProps = {
  /** Label of the button in its resting state. */
  label: string;
  /** Question shown once the button is armed. */
  question: string;
  /** Label of the button that actually performs the action. */
  confirmLabel: string;
  onConfirm: () => void;
};

export function ConfirmButton({ label, question, confirmLabel, onConfirm }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button
        onClick={() => {
          setArmed(true);
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="qw-confirm">
      <p className="qw-confirm__question">{question}</p>
      <div className="qw-confirm__actions">
        <Button
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button
          onClick={() => {
            setArmed(false);
          }}
        >
          やめる
        </Button>
      </div>
    </div>
  );
}
