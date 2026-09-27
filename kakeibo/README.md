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
npm run build      # dist/ にビルドする
```

CI（`.github/workflows/kakeibo-ci.yml`）は、lint・整形の確認・型チェック・テスト・ビルドを回す。

書式は Prettier に任せ、ESLint は書式を見ない（`eslint-config-prettier` で書式のルールを切っている）。
