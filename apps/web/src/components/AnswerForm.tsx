/**
 * Text answer field on the participant play screen.
 *
 * Always on screen, disabled unless the viewer holds the answer right, so that the bottom of
 * the screen does not jump between rounds. Whether it is enabled comes from
 * `canSubmitAnswer`, which mirrors the server rule; the server still decides, and a refusal
 * arrives as a toast.
 *
 * The field is validated with the same `validateAnswerText` the server uses, so the message
 * shown under the input is the message the server would have sent back. The input clears on
 * a successful send, because a sent answer belongs to the host's screen from then on.
 */

import { validateAnswerText, INPUT_CONSTRAINTS } from '@quiz-world/shared';
import { useState, type FormEvent } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import './AnswerForm.css';

export type AnswerFormProps = {
  /** True while the viewer does not hold the answer right. */
  disabled: boolean;
  onSubmit: (answerText: string) => void;
};

export function AnswerForm({ disabled, onSubmit }: AnswerFormProps) {
  const [answerText, setAnswerText] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validated = validateAnswerText(answerText);
    if (!validated.ok) {
      setError(validated.message);
      return;
    }

    setError(undefined);
    setAnswerText('');
    onSubmit(validated.value);
  };

  return (
    <form className="qw-answer-form" onSubmit={handleSubmit}>
      <div className="qw-answer-form__row">
        <Input
          id="answer-text"
          className="qw-answer-form__field"
          label="回答"
          placeholder={disabled ? '回答権があると入力できます' : '回答を入力'}
          value={answerText}
          maxLength={INPUT_CONSTRAINTS.answerText.maxLength}
          autoComplete="off"
          disabled={disabled}
          error={error}
          onChange={(event) => {
            setAnswerText(event.target.value);
          }}
        />
        <Button type="submit" disabled={disabled}>
          送信
        </Button>
      </div>
    </form>
  );
}
