/**
 * The host's inline form for correcting one seat by hand.
 *
 * It edits what the current rules decide by: the score under points, the ○ and × counts under
 * n○m×. Drafts stay strings until the shared validator accepts them, so an empty or mistyped
 * field is explained next to the form instead of being sent. Saving only asks the server; the
 * standings change when the broadcast comes back, like every other host action.
 */

import { useState } from 'react';
import {
  INPUT_CONSTRAINTS,
  validateScoreAdjustment,
  type GameRules,
  type ParticipantState,
  type ScoreAdjustment,
} from '@quiz-world/shared';
import { Button } from './Button';
import { Input } from './Input';
import './ScoreEditor.css';

export type ScoreEditorProps = {
  /** The seat being corrected; its current totals seed the draft. */
  participant: ParticipantState;
  rules: GameRules;
  /** True while the connection is down, when a correction cannot reach the server. */
  disabled: boolean;
  onSave: (adjustment: ScoreAdjustment) => void;
  onCancel: () => void;
};

export function ScoreEditor({ participant, rules, disabled, onSave, onCancel }: ScoreEditorProps) {
  const [score, setScore] = useState(String(participant.score));
  const [correctCount, setCorrectCount] = useState(String(participant.correctCount));
  const [wrongCount, setWrongCount] = useState(String(participant.wrongCount));
  const [error, setError] = useState<string>();
  const numeric = (text: string) => (text.trim() === '' ? NaN : Number(text));
  const id = `score-edit-${participant.id}`;
  return (
    <form
      className="qw-score-editor"
      aria-label={`${participant.name}さんの得点を修正`}
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = validateScoreAdjustment(
          rules.type === 'points'
            ? { type: 'points', score: numeric(score) }
            : {
                type: 'maruBatsu',
                correctCount: numeric(correctCount),
                wrongCount: numeric(wrongCount),
              },
        );
        if (!parsed.ok) {
          setError(parsed.message);
          return;
        }
        onSave(parsed.value);
      }}
    >
      <fieldset disabled={disabled}>
        <div className="qw-score-editor__fields">
          {rules.type === 'points' ? (
            <Input
              id={`${id}-score`}
              label="得点"
              type="number"
              min={INPUT_CONSTRAINTS.adjustedScore.min}
              max={INPUT_CONSTRAINTS.adjustedScore.max}
              step={1}
              required
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          ) : (
            <>
              <Input
                id={`${id}-correct`}
                label="○の数"
                type="number"
                min={INPUT_CONSTRAINTS.adjustedCount.min}
                max={INPUT_CONSTRAINTS.adjustedCount.max}
                step={1}
                required
                value={correctCount}
                onChange={(e) => setCorrectCount(e.target.value)}
              />
              <Input
                id={`${id}-wrong`}
                label="×の数"
                type="number"
                min={INPUT_CONSTRAINTS.adjustedCount.min}
                max={INPUT_CONSTRAINTS.adjustedCount.max}
                step={1}
                required
                value={wrongCount}
                onChange={(e) => setWrongCount(e.target.value)}
              />
            </>
          )}
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <div className="qw-score-editor__actions">
          <Button type="submit">保存</Button>
          <Button type="button" onClick={onCancel}>
            やめる
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
