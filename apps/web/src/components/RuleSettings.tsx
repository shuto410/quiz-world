/** Applied rules stay visible to everyone; the host edits a separate draft before play. */
import { useState } from 'react';
import {
  hasJudgements,
  INPUT_CONSTRAINTS,
  validateGameRules,
  type GameRules,
} from '@quiz-world/shared';
import type { UseRoomSocketResult } from '../hooks/useRoomSocket';
import { formatScoreDelta } from '../game/scoreDelta';
import { Button } from './Button';
import { Input } from './Input';
import './RuleSettings.css';

/** The server state supplies both the published rules and permission to edit them. */
type RuleSettingsProps = {
  connection: Pick<
    UseRoomSocketResult,
    'roomState' | 'participantId' | 'status' | 'roomClosed' | 'updateRules'
  >;
};
function ruleLabel(rules: GameRules): string {
  return rules.type === 'points'
    ? `得点制 · 正解 ${formatScoreDelta(rules.correctPoints)}点 / 不正解 ${formatScoreDelta(rules.wrongPoints)}点`
    : `${rules.correctTarget}○${rules.wrongLimit}× · ${rules.correctTarget}正解で勝ち抜け / ${rules.wrongLimit}誤答で失格`;
}
export function RuleSettings({ connection }: RuleSettingsProps) {
  const { roomState, participantId, status, roomClosed } = connection;
  if (!roomState) return null;
  const isHost = roomState.hostId === participantId;
  const locked = hasJudgements(roomState.participants) || roomState.status === 'finished';
  return (
    <details className="qw-rules">
      <summary>
        <span>試合ルール</span>
        <strong>{ruleLabel(roomState.rules)}</strong>
        <span className="qw-rules__action">{isHost && !locked ? '設定' : '確認'}</span>
      </summary>
      <div className="qw-rules__body">
        <p>
          {roomState.rules.type === 'maruBatsu'
            ? '勝ち抜け・失格した参加者は、その後の早押しには参加できません。'
            : '正解・不正解のたびに、設定された点数を加算します。'}{' '}
          正誤の判定はホストが行います。
        </p>
        {isHost && !locked ? (
          <RuleForm
            key={JSON.stringify(roomState.rules)}
            rules={roomState.rules}
            disabled={status !== 'joined' || roomClosed || roomState.status !== 'idle'}
            onSave={connection.updateRules}
          />
        ) : (
          <p className="qw-rules__note">
            {locked
              ? '判定が始まったため、ルールは固定されています。'
              : 'ホストが最初の判定前に設定できます。'}
          </p>
        )}
      </div>
    </details>
  );
}

/** Draft values remain strings until shared validation rejects empty or invalid entries. */
type RuleFormProps = { rules: GameRules; disabled: boolean; onSave: (rules: GameRules) => void };
function RuleForm({ rules, disabled, onSave }: RuleFormProps) {
  const [type, setType] = useState(rules.type);
  const [correctPoints, setCorrectPoints] = useState(
    String(rules.type === 'points' ? rules.correctPoints : 1),
  );
  const [wrongPoints, setWrongPoints] = useState(
    String(rules.type === 'points' ? rules.wrongPoints : 0),
  );
  const [correctTarget, setCorrectTarget] = useState(
    String(rules.type === 'maruBatsu' ? rules.correctTarget : 7),
  );
  const [wrongLimit, setWrongLimit] = useState(
    String(rules.type === 'maruBatsu' ? rules.wrongLimit : 3),
  );
  const [error, setError] = useState<string>();
  const numeric = (text: string) => (text.trim() === '' ? NaN : Number(text));
  const draft =
    type === 'points'
      ? { type, correctPoints: numeric(correctPoints), wrongPoints: numeric(wrongPoints) }
      : { type, correctTarget: numeric(correctTarget), wrongLimit: numeric(wrongLimit) };
  const unchanged = JSON.stringify(draft) === JSON.stringify(rules);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = validateGameRules(draft);
        if (!parsed.ok) {
          setError(parsed.message);
          return;
        }
        setError(undefined);
        onSave(parsed.value);
      }}
    >
      <fieldset disabled={disabled}>
        <legend>ルールを設定</legend>
        <div className="qw-rules__presets" role="group" aria-label="ルールのプリセット">
          <Button
            type="button"
            aria-pressed={type === 'points'}
            onClick={() => {
              setType('points');
              setError(undefined);
            }}
          >
            得点制
          </Button>
          <Button
            type="button"
            aria-pressed={type === 'maruBatsu' && correctTarget === '7' && wrongLimit === '3'}
            onClick={() => {
              setType('maruBatsu');
              setCorrectTarget('7');
              setWrongLimit('3');
              setError(undefined);
            }}
          >
            7○3×
          </Button>
          <Button
            type="button"
            aria-pressed={type === 'maruBatsu' && (correctTarget !== '7' || wrongLimit !== '3')}
            onClick={() => {
              setType('maruBatsu');
              setError(undefined);
            }}
          >
            n○m×
          </Button>
        </div>
        <div className="qw-rules__fields">
          {type === 'points' ? (
            <>
              <Input
                id="rule-correct"
                label="正解時の点数"
                type="number"
                min={INPUT_CONSTRAINTS.scoreDelta.min}
                max={INPUT_CONSTRAINTS.scoreDelta.max}
                step={1}
                required
                value={correctPoints}
                onChange={(e) => setCorrectPoints(e.target.value)}
              />
              <Input
                id="rule-wrong"
                label="不正解時の点数"
                type="number"
                min={INPUT_CONSTRAINTS.scoreDelta.min}
                max={INPUT_CONSTRAINTS.scoreDelta.max}
                step={1}
                required
                value={wrongPoints}
                onChange={(e) => setWrongPoints(e.target.value)}
              />
            </>
          ) : (
            <>
              <Input
                id="rule-target"
                label="勝ち抜けの正解数（○）"
                type="number"
                min={INPUT_CONSTRAINTS.maruBatsuCount.min}
                max={INPUT_CONSTRAINTS.maruBatsuCount.max}
                step={1}
                required
                value={correctTarget}
                onChange={(e) => setCorrectTarget(e.target.value)}
              />
              <Input
                id="rule-limit"
                label="失格の誤答数（×）"
                type="number"
                min={INPUT_CONSTRAINTS.maruBatsuCount.min}
                max={INPUT_CONSTRAINTS.maruBatsuCount.max}
                step={1}
                required
                value={wrongLimit}
                onChange={(e) => setWrongLimit(e.target.value)}
              />
            </>
          )}
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <div className="qw-rules__save">
          <Button type="submit" disabled={unchanged}>
            ルールを適用
          </Button>
          <p className="qw-rules__note">
            {disabled ? '早押しの受付中に設定できます。' : '最初の判定後は変更できません。'}
          </p>
        </div>
      </fieldset>
    </form>
  );
}
