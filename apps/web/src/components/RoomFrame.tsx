/** Shared room layout keeps tournament context, gameplay and the roster in distinct regions. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Presentational slots; all gameplay state and actions remain owned by the room pages. */
type RoomFrameProps = {
  title: string;
  connectionLabel: string;
  reconnecting?: boolean;
  sidebar?: ReactNode;
  roster: ReactNode;
  actions: ReactNode;
  children: ReactNode;
};

export function RoomFrame({
  title,
  connectionLabel,
  reconnecting = false,
  sidebar,
  roster,
  actions,
  children,
}: RoomFrameProps) {
  return (
    <div className="qw-workspace">
      <aside className="qw-sidebar">
        <Link className="qw-brand" to="/">
          <span className="qw-brand__mark">Q</span> Quiz World
        </Link>
        <details className="qw-room-info">
          <summary>大会情報</summary>
          {sidebar}
        </details>
        <div className="qw-sidebar__footer">{actions}</div>
      </aside>
      <main className="qw-stage">
        <header className="qw-stage__header">
          <h1>{title}</h1>
          <span className="qw-connection">{reconnecting ? '再接続中' : connectionLabel}</span>
        </header>
        {reconnecting ? (
          <div className="qw-connection-banner" role="alert">
            {connectionLabel}
          </div>
        ) : null}
        <div className="qw-stage__content">{children}</div>
      </main>
      <aside className="qw-roster">
        <details open>
          <summary>参加者とスコア</summary>
          {roster}
        </details>
      </aside>
    </div>
  );
}
