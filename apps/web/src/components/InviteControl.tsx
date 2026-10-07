/**
 * The invitation in the room header: the code, readable at a glance, and two ways to copy.
 *
 * The code is shown once and is itself the button that copies it; a small "copy" chip appears
 * on hover or keyboard focus so the affordance costs no space. The join URL is never printed,
 * because nobody reads it. It only has a button. Both the host and the participants see this:
 * the code admits whoever holds it and is no secret from people already in the room.
 */

import { Button } from './Button';
import { useToast } from './Toast';
import './InviteControl.css';

export type InviteControlProps = {
  inviteCode: string;
  inviteUrl: string;
};

export function InviteControl({ inviteCode, inviteUrl }: InviteControlProps) {
  const toast = useToast();
  const copy = (text: string, done: string) => {
    // Absent on insecure origins; say so instead of failing silently.
    if (!('clipboard' in navigator)) {
      toast.show('コピーに失敗しました', 'error');
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => toast.show(done),
      () => toast.show('コピーに失敗しました', 'error'),
    );
  };
  return (
    <div className="qw-invite" role="group" aria-label="招待">
      <span className="qw-invite__label">招待コード</span>
      <button
        type="button"
        className="qw-invite__code"
        aria-label={`招待コード ${inviteCode} をコピー`}
        onClick={() => {
          copy(inviteCode, '招待コードをコピーしました');
        }}
      >
        <span className="qw-invite__value">{inviteCode}</span>
        <span className="qw-invite__chip" aria-hidden="true">
          コピー
        </span>
      </button>
      <Button
        className="qw-invite__url"
        // The visible label shortens on narrow screens; the name must not shorten with it.
        aria-label="URLをコピー"
        onClick={() => {
          copy(inviteUrl, '招待URLをコピーしました');
        }}
      >
        <span>
          URL<span className="qw-invite__url-rest">をコピー</span>
        </span>
      </Button>
    </div>
  );
}
