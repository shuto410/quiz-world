/**
 * Landing page and tournament creation.
 *
 * On success the host token is stored under the new tournament id and the browser moves to
 * the host screen. The invite code and URL are shown there so the host can share them
 * without leaving the room they just opened.
 */

import {
  INPUT_CONSTRAINTS,
  validateMaxParticipants,
  validateTournamentName,
} from '@quiz-world/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createTournament } from '../api/tournaments';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useToast } from '../components/Toast';
import { hostPath, ROUTE_PATHS } from '../routes';
import { saveHostToken, saveInviteDetails } from '../storage/sessionKeys';

export function HomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('10');
  const [nameError, setNameError] = useState<string | undefined>();
  const [maxError, setMaxError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validatedName = validateTournamentName(name);
    const parsedMax = Number(maxParticipants);
    const validatedMax = validateMaxParticipants(
      Number.isFinite(parsedMax) && maxParticipants.trim() !== '' ? parsedMax : maxParticipants,
    );

    setNameError(validatedName.ok ? undefined : validatedName.message);
    setMaxError(validatedMax.ok ? undefined : validatedMax.message);

    if (!validatedName.ok || !validatedMax.ok) {
      return;
    }

    setBusy(true);
    const result = await createTournament({
      name: validatedName.value,
      maxParticipants: validatedMax.value,
    });
    setBusy(false);

    if (!result.ok) {
      toast.show(result.message, 'error');
      return;
    }

    saveHostToken(result.value.tournament.id, result.value.hostToken);
    saveInviteDetails(result.value.tournament.id, {
      inviteCode: result.value.tournament.inviteCode,
      inviteUrl: result.value.inviteUrl,
      name: result.value.tournament.name,
    });
    void navigate(hostPath(result.value.tournament.id));
  }

  return (
    <main className="app-shell">
      <h1>Quiz World</h1>
      <p>出題者と参加者が分かれる、リアルタイム早押しクイズ。</p>

      <form className="qw-form" onSubmit={(event) => void onSubmit(event)}>
        <Input
          id="tournament-name"
          label="大会名"
          value={name}
          maxLength={INPUT_CONSTRAINTS.tournamentName.maxLength}
          onChange={(event) => {
            setName(event.target.value);
          }}
          error={nameError}
          autoComplete="off"
        />
        <Input
          id="max-participants"
          label="最大参加人数"
          type="number"
          min={INPUT_CONSTRAINTS.maxParticipants.min}
          max={INPUT_CONSTRAINTS.maxParticipants.max}
          value={maxParticipants}
          onChange={(event) => {
            setMaxParticipants(event.target.value);
          }}
          error={maxError}
        />
        <Button type="submit" busy={busy}>
          大会を作成
        </Button>
      </form>

      <p className="qw-form-footer">
        招待コードで参加する場合は <Link to={ROUTE_PATHS.join}>参加画面</Link> へ。
      </p>
    </main>
  );
}
