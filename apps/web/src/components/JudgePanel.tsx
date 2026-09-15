/** One press commits a verdict; configured point changes are shown before the host acts. */
import type { GameRules } from '@quiz-world/shared';
import { Button } from './Button';
import { formatScoreDelta } from '../game/scoreDelta';
import './JudgePanel.css';

/** The client supplies only correctness; the server calculates all scoring. */
export type Judgement = { isCorrect: boolean };
/** Controls for the currently displayed responder. */
export type JudgePanelProps = {
  responderName: string;
  rules: GameRules;
  onJudge: (judgement: Judgement) => void;
};
export function JudgePanel({ responderName, rules, onJudge }: JudgePanelProps) {
  return (
    <div className="qw-judge">
      <p className="qw-judge__target">
        <span className="qw-judge__target-name">{responderName}</span> の回答を判定
      </p>
      <div className="qw-judge__verdicts" role="group" aria-label="正誤">
        <Button
          className="qw-judge__verdict qw-judge__verdict--correct"
          aria-label="正解"
          onClick={() => onJudge({ isCorrect: true })}
        >
          <span aria-hidden="true">○</span>
          <strong>正解</strong>
          <small>
            {rules.type === 'points' ? `${formatScoreDelta(rules.correctPoints)}点` : '○を1つ追加'}
          </small>
        </Button>
        <Button
          className="qw-judge__verdict qw-judge__verdict--wrong"
          aria-label="不正解"
          onClick={() => onJudge({ isCorrect: false })}
        >
          <span aria-hidden="true">×</span>
          <strong>不正解</strong>
          <small>
            {rules.type === 'points' ? `${formatScoreDelta(rules.wrongPoints)}点` : '×を1つ追加'}
          </small>
        </Button>
      </div>
      <p className="qw-judge__hint">押すと判定が確定し、全員に結果が表示されます。</p>
    </div>
  );
}
