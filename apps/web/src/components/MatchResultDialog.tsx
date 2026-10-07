/**
 * The popup between two matches: how the match that just ended turned out.
 *
 * It is shown to everyone while the room is in `matchResult`, from the scores the server
 * broadcast, using the same table as the final result. The host starts the next match from
 * here; that is the moment the scores are cleared, so the table is the last look at them.
 *
 * Closing the popup is local and changes nothing on the server. It only uncovers the room,
 * so that somebody can rename themselves or leave between matches. The parent mounts this
 * component only during `matchResult`, which is what reopens it for the next match.
 */

import { useEffect, useRef, useState } from 'react';
import type { GameRules, ParticipantState } from '@quiz-world/shared';
import { Button } from './Button';
import { FinalResult } from './FinalResult';
import './MatchResultDialog.css';

export type MatchResultDialogProps = {
  rules: GameRules;
  participants: readonly ParticipantState[];
  hostId: string;
  /** Whether the viewer holds host authority, according to the broadcast state. */
  isHost: boolean;
  /** True while the connection is down, when the host action cannot reach the server. */
  disabled: boolean;
  onNextMatch: () => void;
};

export function MatchResultDialog({
  rules,
  participants,
  hostId,
  isHost,
  disabled,
  onNextMatch,
}: MatchResultDialogProps) {
  const [dismissed, setDismissed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Keyboard users land inside the popup instead of on the controls it covers.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  if (dismissed) return null;

  return (
    <div className="qw-match-result">
      <div
        ref={dialogRef}
        className="qw-match-result__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qw-match-result-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDismissed(true);
        }}
      >
        <p className="qw-eyebrow">試合終了</p>
        <h2 id="qw-match-result-title">試合結果</h2>
        <FinalResult rules={rules} participants={participants} hostId={hostId} />
        <p className="qw-match-result__note">
          {isHost
            ? '次の試合を始めると、全員の得点がリセットされます。'
            : 'ホストが次の試合を始めるまでお待ちください。'}
        </p>
        <div className="qw-match-result__actions">
          {isHost ? (
            <Button disabled={disabled} onClick={onNextMatch}>
              次の試合へ
            </Button>
          ) : null}
          <Button
            onClick={() => {
              setDismissed(true);
            }}
          >
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}
