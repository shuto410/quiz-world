/**
 * Opens three independent Chrome windows on macOS for manual multiplayer testing.
 * Each role gets persistent, repository-local browser data so ordinary reloads keep its seat
 * while host and participant windows never share localStorage. No application behavior changes.
 */
import { access, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const profileRoot = resolve(root, 'node_modules/.cache/quiz-world-browsers');
const chrome = '/Applications/Google Chrome.app';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write(
      '使い方: npm run debug:windows [-- 招待URL]\n' +
        'macOS + Google Chrome が必要です。先に npm run dev を起動してください。\n' +
        'DEBUG_BASE_URL で開発サーバーのURLを変更できます。\n',
    );
    return;
  }
  if (process.platform !== 'darwin') throw new Error('このコマンドは macOS 用です。');
  if (args.length > 1) throw new Error('引数には招待URLを1つだけ指定してください。');

  const base = new URL(process.env.DEBUG_BASE_URL ?? 'http://localhost:5173');
  const invite = new URL(args[0] ?? '/join', base);
  if (!['http:', 'https:'].includes(base.protocol) || invite.origin !== base.origin) {
    throw new Error(
      '招待URLは開発サーバーと同じオリジンにしてください。DEBUG_BASE_URL で変更できます。',
    );
  }
  await access(chrome).catch(() => {
    throw new Error(`${chrome} が見つかりません。Google Chrome をインストールしてください。`);
  });
  await fetch(new URL('/health', base), { signal: AbortSignal.timeout(3_000) })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    })
    .catch(() => {
      throw new Error(`${base.origin} に接続できません。先に npm run dev を起動してください。`);
    });

  const windows = [
    { role: 'host', label: 'ホスト', url: new URL('/', base) },
    { role: 'participant-a', label: '参加者A', url: invite },
    { role: 'participant-b', label: '参加者B', url: invite },
  ];
  for (const [index, window] of windows.entries()) {
    const profile = resolve(profileRoot, window.role);
    await mkdir(profile, { recursive: true });
    await new Promise((done, reject) => {
      const child = spawn(
        '/usr/bin/open',
        [
          '-n',
          '-a',
          chrome,
          '--args',
          `--user-data-dir=${profile}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--new-window',
          '--window-size=480,850',
          `--window-position=${index * 480},40`,
          window.url.href,
        ],
        { stdio: 'ignore' },
      );
      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0) done();
        else reject(new Error(`${window.label} の起動に失敗しました (${code})。`));
      });
    });
    process.stdout.write(`${window.label}: ${window.url.href}\n`);
  }
  process.stdout.write(
    '\nホストで大会を作り、参加者A・Bには同じ招待コードと別々の表示名を入力してください。\n' +
      `参加記録の保存先: ${profileRoot}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
