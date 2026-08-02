/**
 * Participant play screen placeholder.
 *
 * Buzz and answer UI arrive later. The route is reserved so a successful join has a place
 * to land that is distinct from the host URL.
 */

import { useParams } from 'react-router-dom';

export function PlayPage() {
  const { tournamentId } = useParams();

  return (
    <main className="app-shell">
      <h1>プレイ</h1>
      <p>早押しボタンはゲーム機能のステップで入ります。</p>
      <div className="placeholder-card">
        <p>
          大会 ID: <code>{tournamentId}</code>
        </p>
      </div>
    </main>
  );
}
