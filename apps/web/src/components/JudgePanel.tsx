/**
 * The correct and wrong buttons, always in the same place on the host's screen.
 *
 * They do one of two things, and say which. With a responder waiting, one press commits a
 * verdict and the configured point change is shown on the button before the host acts. With
 * nobody waiting, a press only plays the cue for the room, and the button says so instead of
 * showing points, so the host is never left guessing whether a press will score.
 */
import type { GameRules } from '@quiz-world/shared';
import { Button } from './Button';
import { formatScoreDelta } from '../game/scoreDelta';
import './JudgePanel.css';

/** The client supplies only correctness; the server calculates all scoring. */
export type Judgement = { isCorrect: boolean };
export type JudgePanelProps = {
  /** The seat a press will judge. Absent when a press only plays the cue. */
  responderName?: string | undefined;
  rules: GameRules;
  disabled?: boolean | undefined;
  onJudge: (judgement: Judgement) => void;
};
export function JudgePanel({ responderName, rules, disabled = false, onJudge }: JudgePanelProps) {
  const judging = responderName !== undefined;
  return (
    <div className="qw-judge" data-mode={judging ? 'judge' : 'effect'}>
      <p className="qw-judge__target">
        {judging ? (
          <>
            <span className="qw-judge__target-name">{responderName}</span> の回答を判定
          </>
        ) : (
          '演出のみ（得点は変わりません）'
        )}
      </p>
      <div className="qw-judge__verdicts" role="group" aria-label="正誤">
        <Button
          className="qw-judge__verdict qw-judge__verdict--correct"
          aria-label="正解"
          disabled={disabled}
          onClick={() => onJudge({ isCorrect: true })}
        >
          <span aria-hidden="true">○</span>
          <strong>正解</strong>
          <small>
            {!judging
              ? '演出のみ'
              : rules.type === 'points'
                ? `${formatScoreDelta(rules.correctPoints)}点`
                : '○を1つ追加'}
          </small>
        </Button>
        <Button
          className="qw-judge__verdict qw-judge__verdict--wrong"
          aria-label="不正解"
          disabled={disabled}
          onClick={() => onJudge({ isCorrect: false })}
        >
          <span aria-hidden="true">×</span>
          <strong>不正解</strong>
          <small>
            {!judging
              ? '演出のみ'
              : rules.type === 'points'
                ? `${formatScoreDelta(rules.wrongPoints)}点`
                : '×を1つ追加'}
          </small>
        </Button>
      </div>
      <p className="qw-judge__hint">
        {judging
          ? '押すと判定が確定し、全員に結果が表示されます。'
          : '押すと全員にエフェクトと効果音が流れます。得点は変わりません。'}
      </p>
    </div>
  );
}
