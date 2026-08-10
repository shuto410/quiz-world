/**
 * Browser persistence for host tokens and participant ids.
 *
 * Keys are scoped by tournament id so one browser can hold seats in several rooms. Values
 * survive reloads; clearing site data is how a user deliberately starts as someone new.
 */

const HOST_TOKEN_PREFIX = 'qw:hostToken:';
const PARTICIPANT_ID_PREFIX = 'qw:participantId:';

export function hostTokenKey(tournamentId: string): string {
  return `${HOST_TOKEN_PREFIX}${tournamentId}`;
}

export function participantIdKey(tournamentId: string): string {
  return `${PARTICIPANT_ID_PREFIX}${tournamentId}`;
}

export function saveHostToken(tournamentId: string, hostToken: string): void {
  window.localStorage.setItem(hostTokenKey(tournamentId), hostToken);
}

export function loadHostToken(tournamentId: string): string | undefined {
  return window.localStorage.getItem(hostTokenKey(tournamentId)) ?? undefined;
}

export function saveParticipantId(tournamentId: string, participantId: string): void {
  window.localStorage.setItem(participantIdKey(tournamentId), participantId);
}

export function loadParticipantId(tournamentId: string): string | undefined {
  return window.localStorage.getItem(participantIdKey(tournamentId)) ?? undefined;
}

/** sessionStorage key for invite code / URL shown on the host screen after creation. */
export function inviteDetailsKey(tournamentId: string): string {
  return `qw:inviteDetails:${tournamentId}`;
}

export type StoredInviteDetails = {
  inviteCode: string;
  inviteUrl: string;
  name: string;
};

export function saveInviteDetails(tournamentId: string, details: StoredInviteDetails): void {
  window.sessionStorage.setItem(inviteDetailsKey(tournamentId), JSON.stringify(details));
}

export function loadInviteDetails(tournamentId: string): StoredInviteDetails | undefined {
  const raw = window.sessionStorage.getItem(inviteDetailsKey(tournamentId));
  if (raw === null) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'inviteCode' in parsed &&
      'inviteUrl' in parsed &&
      'name' in parsed &&
      typeof (parsed as StoredInviteDetails).inviteCode === 'string' &&
      typeof (parsed as StoredInviteDetails).inviteUrl === 'string' &&
      typeof (parsed as StoredInviteDetails).name === 'string'
    ) {
      return parsed as StoredInviteDetails;
    }
  } catch {
    return undefined;
  }
  return undefined;
}
