# Quiz World

出題者（ホスト）と参加者に役割が分かれる、リアルタイム早押しクイズ大会プラットフォーム。

ホストが外部資料を見ながら問題を読み上げ、参加者はブラウザから早押しする。早押し順・回答権・スコアはすべて Socket.io サーバーが決定し、全クライアントへ配信する。アプリ内に問題管理機能は持たない。

## 技術構成

| レイヤー         | 採用技術                                            |
| ---------------- | --------------------------------------------------- |
| フロントエンド   | Vite + React + TypeScript（SPA）                    |
| リアルタイム通信 | Socket.io                                           |
| バックエンド     | Express + Socket.io on ECS Fargate                  |
| 配信             | CloudFront + S3（静的） / ALB（API・WebSocket）     |
| 永続化           | DynamoDB（大会設定と `RoomState` スナップショット） |
| IaC              | AWS CDK (TypeScript)                                |

ゲーム状態はサーバーのメモリ上を正とし、DynamoDB には復旧用のスナップショットを TTL つきで書き出す。

## リポジトリ構成

npm workspaces のモノレポ。クライアントとサーバーで Socket イベント型とバリデーションを共有するため。

```
apps/web        # Vite + React + TypeScript (SPA)
apps/server     # Express + Socket.io
packages/shared # ドメイン型、Socketイベント型、バリデーション
infra           # AWS CDK (TypeScript)
docs/design.md  # 設計の唯一の正
AGENTS.md       # 開発規約と不変条件
```

ワークスペースは実装ステップの進行に合わせて追加していく。現時点では `packages/shared` と `apps/server` が存在する。

`apps/server` の内部構成は責務で分かれている。

```
src/domain/      # 状態遷移の純粋関数。I/O、await、時刻取得を禁止（ESLint で強制）
src/rooms/       # RoomRegistry。ルーム状態への唯一のアクセス経路
src/socket/      # Socket.io の配信。broadcastRoomState() が状態配信の唯一の経路
src/tournaments/ # 大会のユースケースと DynamoDB リポジトリ
src/db/          # DynamoDB クライアントとテーブル定義
src/api/         # Express のルートとエラー形式
src/app.ts       # Express アプリ
src/server.ts    # HTTP と Socket.io の組み立て
src/index.ts     # プロセスの入口。環境変数の読み取りと終了処理のみ
```

## セットアップ

Node.js 22 以上が必要。テストに Docker は要らない。

```bash
npm install
npm run check
```

開発時は DynamoDB Local と Socket サーバーを起動する。Docker が必要なのはここだけ。

```bash
cp .env.example .env.local
npm run db:up
npm run dev:server
```

大会を作ってみる。

```bash
curl -X POST http://localhost:3001/api/tournaments \
  -H 'content-type: application/json' \
  -d '{"name":"社内クイズ大会","maxParticipants":20}'
```

```json
{
  "tournament": { "id": "...", "inviteCode": "ECUQEFWQ", "status": "active", "...": "..." },
  "inviteUrl": "http://localhost:5173/join?code=ECUQEFWQ",
  "hostToken": "Cmv-Q13jx6Kybo_ryx8mD9KT8fYSHt0Yoy6ZHLel0AI"
}
```

`hostToken` が返るのはこの1回だけで、サーバーは SHA-256 ハッシュしか保存しない。設定できる環境変数は [`.env.example`](./.env.example) にまとめてある。

招待コードから大会名を引く。

```bash
curl http://localhost:3001/api/tournaments/by-invite-code/ECUQEFWQ | jq
# => { "tournamentId": "...", "name": "社内クイズ大会", "status": "active", "canJoin": true }
```

保存されたレコードを確認する（要 AWS CLI。`brew install awscli`）。

```bash
npm run db:tables
npm run db:scan
```

ブラウザで見たいときは `npm run db:admin` のあと http://localhost:8001 を開く。

## コマンド

| コマンド                | 内容                                                     |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev:server`    | Socket サーバーを watch モードで起動                     |
| `npm run db:up`         | DynamoDB Local を起動（Docker Compose）                  |
| `npm run db:down`       | DynamoDB Local を停止                                    |
| `npm run db:reset`      | ローカル DB のデータを捨てて作り直す（要サーバー再起動） |
| `npm run db:tables`     | Local のテーブル一覧（要 AWS CLI）                       |
| `npm run db:scan`       | Local の大会テーブルを Scan（要 AWS CLI）                |
| `npm run db:admin`      | Local をブラウザで見る GUI（http://localhost:8001）      |
| `npm run check`         | 型チェック + Lint + フォーマット確認 + テスト            |
| `npm run typecheck`     | 全ワークスペースの型チェック                             |
| `npm run lint`          | ESLint（`npm run lint:fix` で自動修正）                  |
| `npm run format`        | Prettier で整形（`npm run format:check` で確認のみ）     |
| `npm run test`          | Vitest（watch モード）                                   |
| `npm run test:run`      | Vitest（1 回実行）                                       |
| `npm run test:coverage` | カバレッジ付きで実行                                     |

## ドキュメント

- [`docs/design.md`](./docs/design.md) — アーキテクチャ、`RoomState` 設計、Socket イベント仕様、AWS 構成、実装ステップ
- [`AGENTS.md`](./AGENTS.md) — 破ってはいけない不変条件、作らないものリスト、コーディング規約
