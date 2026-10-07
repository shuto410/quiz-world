/**
 * Participant entry: one form with the invite code and a display name, and one submit.
 *
 * Arriving from `/join?code=...` fills the code in and looks it up straight away, so the page
 * can say which tournament this is before the name is typed. A code typed by hand is looked up
 * when the form is submitted instead; there is no separate step for it.
 *
 * On success the invitation is remembered for this tournament, so the participant's room can
 * show the same code and join URL the host has, and the play screen is opened with the name in
 * history state so the socket join can fire with a single mount.
 */

import { INPUT_CONSTRAINTS, validateDisplayName, validateInviteCode } from '@quiz-world/shared';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resolveInviteCode } from '../api/tournaments';
import { BuzzerArt, LogoMark } from '../components/BrandArt';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { joinPath, playPath, ROUTE_PATHS } from '../routes';
import { loadParticipantId, saveInviteDetails } from '../storage/sessionKeys';

export type PlayNavigationState = {
  displayName: string;
};

/** What the server said about one invite code. Kept with the code it was asked about. */
type ResolvedInvite = { tournamentId: string; name: string; canJoin: boolean; inviteCode: string };

export function JoinPage() {
  const [params] = useSearchParams();
  const codeFromUrl = params.get('code') ?? '';
  const navigate = useNavigate();
  const toast = useToast();

  const [codeInput, setCodeInput] = useState(codeFromUrl);
  const [codeError, setCodeError] = useState<string | undefined>();
  const [resolved, setResolved] = useState<ResolvedInvite | undefined>();
  const [displayName, setDisplayName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (codeFromUrl === '') {
      return;
    }

    const validated = validateInviteCode(codeFromUrl);
    if (!validated.ok) {
      setCodeError(validated.message);
      toast.show(validated.message, 'error');
      return;
    }

    let cancelled = false;
    void resolveInviteCode(validated.value).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setCodeError(result.message);
        toast.show(result.message, 'error');
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

  // A lookup only describes the code it was made for; editing the field leaves it behind.
  const typed = validateInviteCode(codeInput);
  const known = typed.ok && resolved?.inviteCode === typed.value ? resolved : undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = validateInviteCode(codeInput);
    const name = validateDisplayName(displayName);
    setCodeError(code.ok ? undefined : code.message);
    setNameError(name.ok ? undefined : name.message);
    if (!code.ok) {
      toast.show(code.message, 'error');
      return;
    }
    if (!name.ok) {
      toast.show(name.message, 'error');
      return;
    }

    setJoining(true);
    let target = resolved?.inviteCode === code.value ? resolved : undefined;
    if (target === undefined) {
      const result = await resolveInviteCode(code.value);
      if (!result.ok) {
        setJoining(false);
        setCodeError(result.message);
        toast.show(result.message, 'error');
        return;
      }
      target = {
        tournamentId: result.value.tournamentId,
        name: result.value.name,
        canJoin: result.value.canJoin,
        inviteCode: code.value,
      };
      setResolved(target);
    }

    if (!target.canJoin) {
      setJoining(false);
      setCodeError('この大会は終了しています');
      toast.show('この大会には参加できません', 'error');
      return;
    }

    saveInviteDetails(target.tournamentId, {
      inviteCode: target.inviteCode,
      // The address this app is being served from, which is where invite URLs point.
      inviteUrl: new URL(joinPath(target.inviteCode), window.location.origin).toString(),
      name: target.name,
    });
    void navigate(playPath(target.tournamentId), {
      state: { displayName: name.value } satisfies PlayNavigationState,
    });
  }

  return (
    <JoinLayout>
      <div className="qw-entry__intro">
        <h1>大会に参加</h1>
        <p>
          {known
            ? `「${known.name}」に参加します。表示名を入力してください。`
            : '招待コードと表示名を入力してください。'}
          {known && !known.canJoin ? '（この大会は終了しています）' : null}
        </p>
      </div>

      <form
        className="qw-form"
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <Input
          id="invite-code"
          className="qw-input--code"
          label="招待コード"
          value={codeInput}
          onChange={(event) => {
            setCodeInput(event.target.value.toUpperCase());
            setCodeError(undefined);
          }}
          error={codeError}
          autoComplete="off"
          spellCheck={false}
        />
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
        <Button type="submit" busy={joining} disabled={known !== undefined && !known.canJoin}>
          参加する
        </Button>
      </form>

      {known !== undefined && loadParticipantId(known.tournamentId) !== undefined ? (
        <p className="qw-form-footer">
          このブラウザには以前の参加記録があります。同じ席に復帰します。
        </p>
      ) : null}
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
