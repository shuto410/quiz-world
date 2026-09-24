/**
 * Participant entry: type an invite code, or land here from `/join?code=...`.
 *
 * Flow: resolve the code against the HTTP API → show the tournament name → collect a display
 * name → navigate to the play screen with the name in history state so the socket join can
 * fire with a single mount.
 */

import { INPUT_CONSTRAINTS, validateDisplayName, validateInviteCode } from '@quiz-world/shared';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resolveInviteCode } from '../api/tournaments';
import { BuzzerArt, LogoMark } from '../components/BrandArt';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { playPath, ROUTE_PATHS } from '../routes';
import { loadParticipantId, saveTournamentName } from '../storage/sessionKeys';

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

    saveTournamentName(resolved.tournamentId, resolved.name);
    setJoining(true);
    void navigate(playPath(resolved.tournamentId), {
      state: { displayName: validated.value } satisfies PlayNavigationState,
    });
  }

  if (resolved !== undefined) {
    return (
      <JoinLayout>
        <div className="qw-entry__intro">
          <h1>大会に参加</h1>
          <p>
            「{resolved.name}」に参加します。表示名を入力してください。
            {!resolved.canJoin ? '（この大会は終了しています）' : null}
          </p>
        </div>

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
      </JoinLayout>
    );
  }

  return (
    <JoinLayout>
      <div className="qw-entry__intro">
        <h1>大会に参加</h1>
        <p>招待コードを入力してください。</p>
      </div>

      <form className="qw-form" onSubmit={onSubmitCode}>
        <Input
          id="invite-code"
          className="qw-input--code"
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
    </JoinLayout>
  );
}

/** Entry layout for joining: headline and buzzer art beside the form card. */
function JoinLayout({ children }: { children: ReactNode }) {
  return (
    <div className="qw-entry qw-entry--join">
      <header className="qw-entry__header">
        <Link className="qw-wordmark" to={ROUTE_PATHS.home}>
          <LogoMark />
          Quiz World
        </Link>
      </header>
      <main className="qw-entry__main">
        <section className="qw-entry__hero">
          <p className="qw-entry__headline">
            コードを入れて、
            <br />
            早押しに参加。
          </p>
          <p className="qw-entry__lead">
            ホストから届いた招待コードと、
            <br />
            みんなに表示される名前を入力してください。
          </p>
          <BuzzerArt />
        </section>
        <section className="qw-entry__card">{children}</section>
      </main>
    </div>
  );
}
