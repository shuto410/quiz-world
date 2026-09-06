/**
 * The host's judgement control: verdict, points and what happens next, in one action.
 *
 * The three buttons at the bottom are the only way to submit, and each of them says where
 * the room goes afterwards. That is deliberate: a separate "confirm" button next to a
 * next-action picker would let the host commit a judgement while looking at the wrong
 * follow-up, and a judgement cannot be taken back once the score has moved.
 *
 * Nothing can be submitted until the verdict is chosen, and choosing it fills in the usual
 * number of points so the common case is two clicks. The points remain editable, because
 * `isCorrect` and `scoreDelta` are independent by design: a correct answer may be worth
 * nothing, and a wrong one may cost.
 */

import type { JudgeNextAction } from '@quiz-world/shared';
import { useState } from 'react';
import { parseScoreDelta } from '../game/scoreDelta';
import { Button } from './Button';
import { Input } from './Input';
import './JudgePanel.css';

/** What the host decided, ready to be sent as `judge:submit`. */
export type Judgement = {
  isCorrect: boolean;
  scoreDelta: number;
  nextAction: JudgeNextAction;
};

export type JudgePanelProps = {
  /** Display name of the participant holding the answer right. */
  responderName: string;
  /** False when nobody is queued behind them, which the server would refuse. */
  hasNextResponder: boolean;
  onJudge: (judgement: Judgement) => void;
};

type Verdict = 'correct' | 'wrong';

/** Points filled in when the verdict is picked. Zero for a wrong answer, never a deduction. */
const DEFAULT_SCORE_TEXT: Record<Verdict, string> = {
  correct: '1',
  wrong: '0',
};

const QUICK_SCORES = ['+1', '0', '-1'];

const NEXT_ACTIONS: { action: JudgeNextAction; label: string }[] = [
  { action: 'showResult', label: '結果を表示' },
  { action: 'moveToNextResponder', label: '次の回答者へ' },
  { action: 'resetToIdle', label: '結果を出さず早押しへ' },
];

export function JudgePanel({ responderName, hasNextResponder, onJudge }: JudgePanelProps) {
  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined);
  const [scoreText, setScoreText] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const chooseVerdict = (next: Verdict) => {
    setVerdict(next);
    setScoreText(DEFAULT_SCORE_TEXT[next]);
    setError(undefined);
  };

  const judge = (nextAction: JudgeNextAction) => {
    if (verdict === undefined) {
      return;
    }

    const scoreDelta = parseScoreDelta(scoreText);
    if (!scoreDelta.ok) {
      setError(scoreDelta.message);
      return;
    }

    setVerdict(undefined);
    setScoreText('');
    setError(undefined);
    onJudge({ isCorrect: verdict === 'correct', scoreDelta: scoreDelta.value, nextAction });
  };

  return (
    <div className="qw-judge">
      <p className="qw-judge__target">
        <span className="qw-judge__target-name">{responderName}</span> の回答を判定
      </p>

      <div className="qw-judge__verdicts" role="group" aria-label="正誤">
        <Button
          className="qw-judge__verdict"
          aria-pressed={verdict === 'correct'}
          onClick={() => {
            chooseVerdict('correct');
          }}
        >
          正解
        </Button>
        <Button
          className="qw-judge__verdict"
          aria-pressed={verdict === 'wrong'}
          onClick={() => {
            chooseVerdict('wrong');
          }}
        >
          不正解
        </Button>
      </div>

      <div className="qw-judge__score">
        <Input
          id="judge-score"
          className="qw-judge__score-field"
          label="得点"
          type="number"
          inputMode="numeric"
          value={scoreText}
          error={error}
          onChange={(event) => {
            setScoreText(event.target.value);
            setError(undefined);
          }}
        />
        <div className="qw-judge__quick" role="group" aria-label="得点のクイック入力">
          {QUICK_SCORES.map((quick) => (
            <Button
              key={quick}
              className="qw-judge__quick-button"
              onClick={() => {
                setScoreText(quick.replace('+', ''));
                setError(undefined);
              }}
            >
              {quick}
            </Button>
          ))}
        </div>
      </div>

      <div className="qw-judge__actions">
        {NEXT_ACTIONS.map(({ action, label }) => {
          const unavailable = action === 'moveToNextResponder' && !hasNextResponder;
          return (
            <Button
              key={action}
              disabled={verdict === undefined || unavailable}
              onClick={() => {
                judge(action);
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>

      {verdict === undefined ? (
        <p className="qw-judge__hint">正誤を選ぶと確定できます</p>
      ) : hasNextResponder ? null : (
        <p className="qw-judge__hint">ほかに早押しした人がいないため、次の回答者へは進めません</p>
      )}
    </div>
  );
}
