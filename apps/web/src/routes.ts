/**
 * Path helpers for the SPA.
 *
 * Invite URLs are built by the server as `{PUBLIC_BASE_URL}/join?code=...`, so the join
 * path here is part of the public contract. Keeping the path strings in one place means a
 * renamed route cannot silently diverge from that URL shape.
 */

/** Paths the router mounts. Listed so a missing screen fails loudly in tests. */
export const ROUTE_PATHS = {
  home: '/',
  join: '/join',
  host: '/host/:tournamentId',
  play: '/play/:tournamentId',
} as const;

export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

/** Builds the participant join URL, optionally with an invite code already filled in. */
export function joinPath(inviteCode?: string): string {
  if (inviteCode === undefined || inviteCode === '') {
    return ROUTE_PATHS.join;
  }
  return `${ROUTE_PATHS.join}?code=${encodeURIComponent(inviteCode)}`;
}

/** Host progress screen for a tournament the browser already holds a token for. */
export function hostPath(tournamentId: string): string {
  return `/host/${encodeURIComponent(tournamentId)}`;
}

/** Participant play screen after a successful join. */
export function playPath(tournamentId: string): string {
  return `/play/${encodeURIComponent(tournamentId)}`;
}
