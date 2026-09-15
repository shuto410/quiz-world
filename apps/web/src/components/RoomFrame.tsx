/** Shared room layout keeps tournament context, gameplay and the roster in distinct regions. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { RoomDisclosure } from './RoomDisclosure';
import './RoomFrame.css';

/** Presentational slots; all gameplay state and actions remain owned by the room pages. */
type RoomFrameProps = {
  title: string;
  identity: string;
  roleLabel: string;
  connectionLabel: string;
  reconnecting?: boolean;
  roomInfo?: ReactNode;
  roster: ReactNode;
  rosterCount: number;
  actions: ReactNode;
  children: ReactNode;
};

export function RoomFrame({
  title,
  identity,
  roleLabel,
  connectionLabel,
  reconnecting = false,
  roomInfo,
  roster,
  rosterCount,
  actions,
  children,
}: RoomFrameProps) {
  return (
    <div className="qw-workspace">
      <header className="qw-room-toolbar">
        <Link className="qw-brand" to="/">
          <span className="qw-brand__mark" aria-hidden="true">
            Q
          </span>{' '}
          Quiz World
        </Link>
        {roomInfo ? (
          <RoomDisclosure
            className="qw-room-info"
            label={
              <>
                招待する <span aria-hidden="true">↗</span>
              </>
            }
          >
            {roomInfo}
          </RoomDisclosure>
        ) : null}
        <RoomDisclosure
          className="qw-room-toolbar__actions"
          label={
            <>
              参加情報 <span aria-hidden="true">⌄</span>
            </>
          }
        >
          <div className="qw-room-account">
            <p>
              {identity}
              <span>{roleLabel}</span>
            </p>
            {actions}
          </div>
        </RoomDisclosure>
      </header>
      <main className="qw-stage">
        <header className="qw-stage__header">
          <div className="qw-room-heading">
            <h1>{title}</h1>
            <p>
              <span className="qw-role">{roleLabel}</span>
              {identity !== roleLabel ? <span>{identity}</span> : null}
            </p>
          </div>
          <span className="qw-connection" data-connected={connectionLabel === '接続中'}>
            {reconnecting ? '再接続中' : connectionLabel}
          </span>
        </header>
        {reconnecting ? (
          <div className="qw-connection-banner" role="alert">
            {connectionLabel}
          </div>
        ) : null}
        <div className="qw-stage__content">{children}</div>
      </main>
      <aside className="qw-roster" aria-label="参加者とスコア">
        <details open>
          <summary>
            <span>スコアボード</span>
            <span className="qw-roster__count">{rosterCount}人</span>
          </summary>
          {roster}
        </details>
      </aside>
    </div>
  );
}
