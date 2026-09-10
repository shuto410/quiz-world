/**
 * Participant entry: type an invite code, or land here from `/join?code=...`.
 *
 * Flow: resolve the code against the HTTP API → show the tournament name → collect a display
 * name → navigate to the play screen with the name in history state so the socket join can
 * fire with a single mount.
 */

import { INPUT_CONSTRAINTS, validateDisplayName, validateInviteCode } from '@quiz-world/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resolveInviteCode } from '../api/tournaments';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { playPath } from '../routes';
import { loadParticipantId } from '../storage/sessionKeys';

export type PlayNavigationState = {
  displayName: string;
};

export function JoinPage() {
  const [params, setParams] = useSearchParams();
  const codeFromUrl = params.get('code') ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const [codeInput, setCodeInput] = useState(codeFromUrl);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<
    { tournamentId: string; name: string; canJoin: boolean; inviteCode: string } | undefined
  >();

  const [displayName, setDisplayName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (codeFromUrl === '') {
      setResolved(undefined);
      return;
    }

    const validated = validateInviteCode(codeFromUrl);
    if (!validated.ok) {
      setCodeError(validated.message);
      toast.show(validated.message, 'error');
      setResolved(undefined);
      return;
    }

    let cancelled = false;
    setResolving(true);
    void resolveInviteCode(validated.value).then((result) => {
      if (cancelled) {
        return;
      }
      setResolving(false);
      if (!result.ok) {
        setCodeError(result.message);
        toast.show(result.message, 'error');
        setResolved(undefined);
        return;
      }
      setResolved({
        tournamentId: result.value.tournamentId,
        name: result.value.name,
        canJoin: result.value.canJoin,
        inviteCode: validated.value,
      });
      setCodeError(undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [codeFromUrl, toast.show]);

  function onSubmitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validated = validateInviteCode(codeInput);
    if (!validated.ok) {
      setCodeError(validated.message);
      toast.show(validated.message, 'error');
      return;
    }
    setParams({ code: validated.value });
  }

  function onSubmitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (resolved === undefined) {
      return;
    }

    const validated = validateDisplayName(displayName);
    if (!validated.ok) {
      setNameError(validated.message);
      toast.show(validated.message, 'error');
      return;
    }

    if (!resolved.canJoin) {
      toast.show('この大会には参加できません', 'error');
      return;
    }

    setJoining(true);
    void navigate(playPath(resolved.tournamentId), {
      state: { displayName: validated.value } satisfies PlayNavigationState,
    });
  }

  if (resolved !== undefined) {
    return (
      <main className="app-shell">
        <h1>大会に参加</h1>
        <p>
          「{resolved.name}」に参加します。表示名を入力してください。
          {!resolved.canJoin ? '（この大会は終了しています）' : null}
        </p>

        <form className="qw-form" onSubmit={onSubmitName}>
          <Input
            id="display-name"
            label="表示名"
            value={displayName}
            maxLength={INPUT_CONSTRAINTS.displayName.maxLength}
            onChange={(event) => {
              setDisplayName(event.target.value);
            }}
            error={nameError}
            autoComplete="nickname"
          />
          <Button type="submit" busy={joining} disabled={!resolved.canJoin}>
            参加する
          </Button>
        </form>

        {loadParticipantId(resolved.tournamentId) !== undefined ? (
          <p className="qw-form-footer">
            このブラウザには以前の参加記録があります。同じ席に復帰します。
          </p>
        ) : null}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <h1>大会に参加</h1>
      <p>招待コードを入力してください。</p>

      <form className="qw-form" onSubmit={onSubmitCode}>
        <Input
          id="invite-code"
          label="招待コード"
          value={codeInput}
          onChange={(event) => {
            setCodeInput(event.target.value.toUpperCase());
          }}
          error={codeError}
          autoComplete="off"
          spellCheck={false}
        />
        <Button type="submit" busy={resolving}>
          次へ
        </Button>
      </form>
    </main>
  );
}
