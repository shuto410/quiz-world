/**
 * Shared room layout: a header (logo, mode and tournament chip, invite code, rule settings and
 * the viewer's own seat), the game area, and the score ranking beside it.
 *
 * On phones the buzz order and the score ranking share one slot, switched by a two-tab strip.
 * The selected tab is view state only; nothing about the game depends on it.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from './BrandArt';
import { RoomDisclosure } from './RoomDisclosure';
import './RoomFrame.css';

/** Presentational slots; all gameplay state and actions remain owned by the room pages. */
type RoomFrameProps = {
  title: string;
  /** Name of the current game mode, shown in the header chip. */
  modeName?: string | undefined;
  identity: string;
  /** Short line under the viewer's name, such as rank and score. Falls back to the role. */
  identityDetail?: string | undefined;
  roleLabel: string;
  connectionLabel: string;
  reconnecting?: boolean;
  /** Invite code shown on the invite disclosure when the viewer can invite. */
  roomCode?: string | undefined;
  roomInfo?: ReactNode;
  /** Rule settings control placed in the header. */
  settings?: ReactNode;
  roster: ReactNode;
  rosterCount: number;
  actions: ReactNode;
  children: ReactNode;
};

type MobileTab = 'order' | 'score';

export function RoomFrame({
  title,
  modeName,
  identity,
  identityDetail,
  roleLabel,
  connectionLabel,
  reconnecting = false,
  roomCode,
  roomInfo,
  settings,
  roster,
  rosterCount,
  actions,
  children,
}: RoomFrameProps) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('order');
  const initial = Array.from(identity)[0] ?? '';
  return (
    <div className="qw-workspace" data-mobile-tab={mobileTab}>
      <header className="qw-room-toolbar">
        <Link className="qw-wordmark qw-brand" to="/">
          <LogoMark />
          Quiz World
        </Link>
        <h1 className="qw-room-title">
          <svg className="qw-room-title__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
          </svg>
          {modeName ? <span className="qw-room-title__mode">{modeName}</span> : null}
          <span className="qw-room-title__name">{title}</span>
        </h1>
        <div className="qw-room-toolbar__end">
          {roomInfo ? (
            <RoomDisclosure
              className="qw-room-info"
              label={
                <>
                  <span className="qw-room-info__label">ルームコード</span>
                  {roomCode ? <span className="qw-room-info__code">{roomCode}</span> : null}
                </>
              }
            >
              {roomInfo}
            </RoomDisclosure>
          ) : null}
          {settings}
          <RoomDisclosure
            className="qw-room-toolbar__actions"
            label={
              <>
                <span className="qw-avatar" aria-hidden="true">
                  {initial}
                </span>
                <span className="qw-account-summary">
                  <span className="qw-account-summary__name">{identity}</span>
                  <span className="qw-account-summary__detail">{identityDetail ?? roleLabel}</span>
                </span>
                <span className="qw-visually-hidden">参加情報</span>
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
        </div>
      </header>
      <main className="qw-stage">
        <p className="qw-connection" data-connected={connectionLabel === '接続中'}>
          {reconnecting ? '再接続中' : connectionLabel}
        </p>
        {reconnecting ? (
          <div className="qw-connection-banner" role="alert">
            {connectionLabel}
          </div>
        ) : null}
        <div className="qw-stage__content">{children}</div>
      </main>
      <div className="qw-room-tabs" role="tablist" aria-label="表示切り替え">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'order'}
          onClick={() => setMobileTab('order')}
        >
          着順
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'score'}
          onClick={() => setMobileTab('score')}
        >
          得点
        </button>
      </div>
      <aside className="qw-roster" aria-label="参加者とスコア">
        <details open>
          <summary>
            <span>得点ランキング</span>
            <span className="qw-roster__count">{rosterCount}人</span>
          </summary>
          {roster}
        </details>
      </aside>
    </div>
  );
}
