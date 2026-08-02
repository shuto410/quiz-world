/**
 * Landing / tournament creation entry.
 *
 * The create form arrives in step 8. For now this page only proves the router and the
 * shared shell render.
 */

import { Link } from 'react-router-dom';
import { ROUTE_PATHS } from '../routes';

export function HomePage() {
  return (
    <main className="app-shell">
      <h1>Quiz World</h1>
      <p>出題者と参加者が分かれる、リアルタイム早押しクイズ。</p>
      <div className="placeholder-card">
        <p>大会作成フォームは次のステップで入ります。</p>
        <p>
          招待コードで参加する場合は <Link to={ROUTE_PATHS.join}>参加画面</Link> へ。
        </p>
      </div>
    </main>
  );
}
