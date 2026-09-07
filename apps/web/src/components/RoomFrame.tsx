/** Shared room layout keeps tournament context, gameplay and the roster in distinct regions. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Presentational slots; all gameplay state and actions remain owned by the room pages. */
type RoomFrameProps = {
  title: string;
  connectionLabel: string;
  sidebar?: ReactNode;
  roster: ReactNode;
  actions: ReactNode;
  children: ReactNode;
};

export function RoomFrame({
  title,
  connectionLabel,
  sidebar,
  roster,
  actions,
  children,
}: RoomFrameProps) {
  return (
    <div className="qw-workspace">
      <aside className="qw-sidebar">
        <Link className="qw-brand" to="/">
          {' '}
          <span className="qw-brand__mark">Q</span> Quiz World
        </Link>
        <div className="qw-sidebar__room">
          <span className="qw-eyebrow">TOURNAMENT ROOM</span>
          <h2>{title}</h2>
        </div>
        <div className="qw-channel">
          <span aria-hidden="true">#</span> クイズルーム
        </div>
        {sidebar}
        <div className="qw-sidebar__footer">
          <p>声を合わせて、知識を競おう。</p>
          {actions}
        </div>
      </aside>
      <main className="qw-stage">
        <header className="qw-stage__header">
          <h1>{title}</h1>
          <span className="qw-connection">{connectionLabel}</span>
        </header>
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
