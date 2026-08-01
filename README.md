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
src/domain/     # 状態遷移の純粋関数。I/O、await、時刻取得を禁止（ESLint で強制）
src/rooms/      # RoomRegistry。ルーム状態への唯一のアクセス経路
src/socket/     # Socket.io の配信。broadcastRoomState() が状態配信の唯一の経路
src/app.ts      # Express アプリ
src/server.ts   # HTTP と Socket.io の組み立て
src/index.ts    # プロセスの入口。環境変数の読み取りと終了処理のみ
```

## セットアップ

Node.js 22 以上が必要。

```bash
npm install
npm run check
```

Socket サーバーを起動する。

```bash
npm run dev:server
curl http://localhost:3001/health   # => {"status":"ok"}
```

`PORT` と `LOG_LEVEL` で挙動を変えられる。既定値は `3001` と `info`。

## コマンド

| コマンド                | 内容                                                 |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev:server`    | Socket サーバーを watch モードで起動                 |
| `npm run check`         | 型チェック + Lint + フォーマット確認 + テスト        |
| `npm run typecheck`     | 全ワークスペースの型チェック                         |
| `npm run lint`          | ESLint（`npm run lint:fix` で自動修正）              |
| `npm run format`        | Prettier で整形（`npm run format:check` で確認のみ） |
| `npm run test`          | Vitest（watch モード）                               |
| `npm run test:run`      | Vitest（1 回実行）                                   |
| `npm run test:coverage` | カバレッジ付きで実行                                 |

## ドキュメント

- [`docs/design.md`](./docs/design.md) — アーキテクチャ、`RoomState` 設計、Socket イベント仕様、AWS 構成、実装ステップ
- [`AGENTS.md`](./AGENTS.md) — 破ってはいけない不変条件、作らないものリスト、コーディング規約
