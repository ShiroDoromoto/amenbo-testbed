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

`master` に push すると、`.github/workflows/kakeibo-deploy.yml` が lint・型チェック・ユニットテストを回してビルドし、GitHub Pages（`https://shirodoromoto.github.io/amenbo-testbed/`）へデプロイする。
ビルドでは `vite.config.ts` の `base` を `/amenbo-testbed/` にする。開発サーバーは `/` のまま。
初めて使う前に、リポジトリの Settings → Pages で配信元（Source）を GitHub Actions にする（管理者権限が要る）。

書式は Prettier に任せ、ESLint は書式を見ない（`eslint-config-prettier` で書式のルールを切っている）。

## 見た目の値

色・余白・文字サイズは、`src/styles/tokens.css` の CSS 変数（デザイントークン）で決める。
CSS には値を直に書かず、`var(--color-text)` のようにトークンを参照する。
新しい値が要るときは、先に `tokens.css` へトークンを足す。
参照した変数が `tokens.css` に無いと、ユニットテスト（`src/styles/tokens.test.ts`）が落ちる。

## トースト通知

一時的な通知は `src/components/Toast/` の `useToast` で出す。`App` が `ToastProvider` で全体を包んでいるので、どの画面からでも使える。

```tsx
const toast = useToast();
toast.show('保存しました', { kind: 'success' });
toast.show('保存できませんでした', { kind: 'error', duration: 0 });
```

`kind` は `info`（既定）・`success`・`error`。`error` は `role="alert"`、ほかは `role="status"` で出す。
`duration` はミリ秒で、既定は 4000。0 にすると、閉じるボタンを押すか `dismiss(id)` を呼ぶまで残る。

## 確認ダイアログ

操作の前に確かめるときは、`src/components/ConfirmDialog/` の `ConfirmDialog` を出す。開くかどうかは、呼ぶ側が `open` で決める。

```tsx
<ConfirmDialog
  open={confirming}
  title="取引を削除しますか？"
  confirmLabel="削除する"
  danger
  onConfirm={remove}
  onCancel={() => setConfirming(false)}
>
  <p>この操作は取り消せません。</p>
</ConfirmDialog>
```

ボタンの文言は、既定で「キャンセル」と「OK」。`danger` を付けると、確定ボタンを `--color-danger` の色にする。
キャンセルボタン・Escape キー・背景のクリックで `onCancel` を呼ぶ。
開くとキャンセルボタンにフォーカスを置き、閉じると開く前にフォーカスがあった場所へ戻す。

## データのスキーマを変える

データは IndexedDB に置く（`src/db/`）。スキーマのバージョンは、`src/db/migrations/` にある移行の数で決まる。

ストアや索引を変えるとき、既存のデータを書き換えるときは、次の手順で移行を足す。

1. `src/db/migrations/vN.ts` を作り、`version: N` の移行を書く（N は今の最後のバージョン + 1）。
2. `src/db/migrations/index.ts` の `migrations` の末尾に加える。

DB を開くと、保存されているバージョンより新しい移行だけが古い順に当たる。
どれかが失敗すると、DB は開く前のバージョンのまま残る。当て済みの移行は書き換えない。

初回起動時には、移行 `v2` が既定のカテゴリ（`src/db/seed.ts` の `defaultCategories`）を登録する。
移行は DB ごとに一度しか当たらないので、利用者がカテゴリを全部消しても登録し直さない。

## 定期取引

起動すると、画面を描く前に `src/app/startup.ts` の `runStartupTasks` が、定期取引から今日までの取引を作る。
取引は月に一度、`dayOfMonth` 日の日付で作る。その月にその日が無ければ末日にする。
作った回の日付を、定期取引の `lastGeneratedOn` に残す。次の起動では、その月より後の月の分から作る。
しばらく開かなかった月の分は、次の起動でまとめて作る。一度も作っていない定期取引は、起動した月の分から作り、前の月へはさかのぼらない。
