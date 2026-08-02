/**
 * Participant entry: type an invite code, or land here from `/join?code=...`.
 *
 * The name form and the invite-code lookup against the API arrive in step 8. This page
 * exists so the server-built invite URL already resolves to a real route.
 */

import { useSearchParams } from 'react-router-dom';

export function JoinPage() {
  const [params] = useSearchParams();
  const code = params.get('code');

  return (
    <main className="app-shell">
      <h1>大会に参加</h1>
      <p>招待コードを入れる画面は次のステップで入ります。</p>
      <div className="placeholder-card">
        {code === null || code === '' ? (
          <p>招待コードはまだ入力されていません。</p>
        ) : (
          <p>
            受け取った招待コード: <code>{code}</code>
          </p>
        )}
      </div>
    </main>
  );
}
