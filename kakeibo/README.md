# kakeibo

ブラウザで動く家計簿アプリ。Amenbo のオートメーションで作る。

Preact + TypeScript で作り、Vite でビルドする。

## 使い方

Node.js 24 で動かす。コマンドはこのディレクトリで打つ。

```sh
npm install        # 依存を入れる
npm run dev        # 開発サーバーを立ち上げる
npm run lint       # ESLint
npm run format     # Prettier で整形する（format:check は整形を確かめるだけ）
npm run typecheck  # 型チェック（tsc）
npm test           # ユニットテスト（Vitest）
npm run test:e2e   # E2E テスト（Playwright）。開発サーバーを 5317 番で立ち上げて回す
npm run build      # dist/ にビルドする
```

E2E テストは `e2e/` に置く。初めて回す前に `npx playwright install chromium` でブラウザを入れる。

CI（`.github/workflows/kakeibo-ci.yml`）は、lint・整形の確認・型チェック・ユニットテスト・E2E テスト・ビルドを回す。

書式は Prettier に任せ、ESLint は書式を見ない（`eslint-config-prettier` で書式のルールを切っている）。

## データのスキーマを変える

データは IndexedDB に置く（`src/db/`）。スキーマのバージョンは、`src/db/migrations/` にある移行の数で決まる。

ストアや索引を変えるとき、既存のデータを書き換えるときは、次の手順で移行を足す。

1. `src/db/migrations/vN.ts` を作り、`version: N` の移行を書く（N は今の最後のバージョン + 1）。
2. `src/db/migrations/index.ts` の `migrations` の末尾に加える。

DB を開くと、保存されているバージョンより新しい移行だけが古い順に当たる。
どれかが失敗すると、DB は開く前のバージョンのまま残る。当て済みの移行は書き換えない。
