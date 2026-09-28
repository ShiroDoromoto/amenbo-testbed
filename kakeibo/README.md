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
`action` を渡すと、文言の横にボタンを添える。押すと `onClick` を呼び、トーストを閉じる。

```tsx
toast.show('削除しました', { duration: 5000, action: { label: '元に戻す', onClick: undo } });
```

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
Tab キーのフォーカスはダイアログの中で回る。説明に `select` などの入力欄を置くと、それも回る先に入る。

## データのスキーマを変える

データは IndexedDB に置く（`src/db/`）。スキーマのバージョンは、`src/db/migrations/` にある移行の数で決まる。

ストアや索引を変えるとき、既存のデータを書き換えるときは、次の手順で移行を足す。

1. `src/db/migrations/vN.ts` を作り、`version: N` の移行を書く（N は今の最後のバージョン + 1）。
2. `src/db/migrations/index.ts` の `migrations` の末尾に加える。

DB を開くと、保存されているバージョンより新しい移行だけが古い順に当たる。
どれかが失敗すると、DB は開く前のバージョンのまま残る。当て済みの移行は書き換えない。

初回起動時には、移行 `v2` が既定のカテゴリ（`src/db/seed.ts` の `defaultCategories`）を登録する。
移行は DB ごとに一度しか当たらないので、利用者がカテゴリを全部消しても登録し直さない。

## カテゴリの並べ替え

カテゴリの管理画面（`#/categories`）では、行の先頭のつまみ（⠿）をドラッグすると、同じ収支区分の中で並べ替えられる。
キーボードでは、つまみにフォーカスして上下の矢印キーで1つずつ動かす。
並べ替えると、その収支区分のカテゴリの `order` を 0 から振り直して保存する（`reorderCategories`）。
ドラッグは Pointer Events で受けるので、スマホのタッチでも動く。

## 定期取引

起動すると、画面を描く前に `src/app/startup.ts` の `runStartupTasks` が、定期取引から今日までの取引を作る。
取引は月に一度、`dayOfMonth` 日の日付で作る。その月にその日が無ければ末日にする。
作った回の日付を、定期取引の `lastGeneratedOn` に残す。次の起動では、その月より後の月の分から作る。
しばらく開かなかった月の分は、次の起動でまとめて作る。一度も作っていない定期取引は、起動した月の分から作り、前の月へはさかのぼらない。

## 取引の入力

取引の入力画面は、前回保存したときに選んだカテゴリと口座を初期値にする。カテゴリは収支区分ごとに覚える。
覚えた値はブラウザの localStorage（キー `kakeibo:lastSelection`）に置くので、端末ごとに別になる。
覚えたカテゴリや口座が消されていたら、初期値にしない。

## 取引の一覧

一覧で選んだ月と絞り込みの条件は、URL のハッシュのクエリに持たせる（例：`#/transactions?month=2026-08&type=expense&memo=ランチ`）。
再読み込みしても、URL を開き直しても、同じ条件で出る。
キーは `month`（`YYYY-MM`）・`account`・`type`（`income` か `expense`）・`category`・`memo`・`min`・`max`。
絞り込まない項目と今月は書かない。読めない `month` と `type` は、今月・すべての区分として扱う。
クエリの読み書きは `src/router/hash.ts` の `queryFromHash` と `replaceHashQuery` で行う。`replaceHashQuery` は履歴を積まない。

一覧の「選択」を押すと、取引にチェックボックスを出す。選んだ取引は、確認ダイアログで確かめてからまとめて削除する。
選べるのは、いま一覧に出ている取引だけ。絞り込みで隠れた取引は、選んでいても消さない。
削除してから5秒間は、トーストの「元に戻す」で、消した取引を同じ id のまままとめて入れ直せる。

## 口座の一覧

口座の一覧画面（`#/accounts`）は、口座ごとに種類と現在の残高を出す（`src/pages/accounts/`）。
口座があれば、その下に、今月までの 12 か月の月末の残高の合計を折れ線グラフで出す（`BalanceTrendChart`）。
数え方は `src/domain/balance.ts` の `calculateBalanceTrend` と同じで、初期残高を含め、振替は口座の間で相殺される。
線の色は `--color-primary`。残高はマイナスにもなるので、縦軸は 0 から始めない。
canvas の中には、月末の残高の表を置く。

## ダッシュボード

トップ画面（`#/`）はダッシュボードで、今月の収入・支出・差額を出す（`src/pages/dashboard/`）。
数え方は `src/domain/summary/monthly.ts` の `calculateMonthlySummary` と同じで、振替は数えない。
差額は、収入が多ければ `+` を付けて収入の色、支出が多ければ `-` を付けて支出の色で出す。
スマホ幅では、3つの項目を縦に積む。

その下に、今月の支出をカテゴリ別に円グラフで出す（`ExpenseByCategoryChart`）。
数え方は `src/domain/summary/byCategory.ts` の `calculateExpenseByCategory` と同じで、多い順に並べる。
扇の色はカテゴリの表示色にする。凡例は Chart.js のものを使わず、グラフの下にカテゴリ・金額・割合の一覧を出す。
消されたカテゴリの支出は「（削除済み）」の名前と `--color-text-muted` の色で出す。今月の支出が無ければ、グラフを描かない。

さらにその下に、今月までの 12 か月の収入と支出を、月ごとに並べた棒グラフで出す（`MonthlyTrendChart`）。
数え方は `src/domain/summary/trend.ts` の `calculateMonthlyTrend` と同じ。
棒の色は、収入が `--color-income`、支出が `--color-expense`。横軸は月だけ、縦軸は「25万円」のように短く書く。
canvas の中には、月ごとの収入・支出・差額の表を置く。12 か月のどの月にも取引が無ければ、グラフを描かない。

## 年間レポート

レポート画面（`#/reports`）は、1年分の支出と収入を、カテゴリ × 月の表で出す（`src/pages/report/`）。
行はカテゴリ、列は 1月〜12月と合計で、いちばん下に月ごとの合計の行を置く。数え方は `calculateAnnualReport` で、振替は数えない。
その年に取引の無いカテゴリは行にしない。行はカテゴリの並び順にし、消されたカテゴリは「（削除済み）」の名前で後ろに置く。
表の金額には「円」を付けず、表の見出し（caption）に単位を書く。
「前年」「翌年」で年を切り替える。出す年は URL のハッシュのクエリ `year`（例：`#/reports?year=2025`）に持たせ、今年なら書かない。
幅が足りなければ、表だけを横にスクロールする。カテゴリの列は左に残る。

## グラフ

グラフは `src/components/charts/` の `Chart` で描く。中では Chart.js を使う。

```tsx
<Chart
  type="bar"
  label="月ごとの支出"
  data={{ labels: ['8月', '9月'], datasets: [{ label: '支出', data: [52000, 48000] }] }}
>
  <p>8月 52,000円、9月 48,000円</p>
</Chart>
```

`type` は Chart.js のグラフの種類（`bar`・`line`・`doughnut` など）。`data` と `options` は Chart.js の形でそのまま渡す。
`label` は canvas の `aria-label` になる。`children` は canvas の中に置き、canvas を描けないときと支援技術に向けた中身にする。
幅は親に合わせ、高さは `--size-chart-height`（スマホ幅では `--size-chart-height-sm`）で決める。
`data` と `options` が変わると描き直し、`type` が変わると作り直す。

canvas には CSS の `var(--…)` が効かない。系列の色は `readToken('--color-income')` のように tokens.css から読んで渡す。
文字と罫線の色・書体は、`Chart` が tokens.css に合わせる。
目盛りとツールチップの文言は、`shortMonthLabel`（「9月」）・`longMonthLabel`（「2026年9月」）・`compactYenLabel`（「25万円」）でそろえる。
