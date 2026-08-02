/**
 * Host progress screen placeholder.
 *
 * The real controls arrive with the game flow. The route is mounted now so that after
 * creation the host can be sent to a stable URL keyed by tournament id.
 */

import { useParams } from 'react-router-dom';

export function HostPage() {
  const { tournamentId } = useParams();

  return (
    <main className="app-shell">
      <h1>ホスト進行</h1>
      <p>進行用の操作はゲーム機能のステップで入ります。</p>
      <div className="placeholder-card">
        <p>
          大会 ID: <code>{tournamentId}</code>
        </p>
      </div>
    </main>
  );
}
