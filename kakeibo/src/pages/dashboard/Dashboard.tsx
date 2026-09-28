import { useEffect, useState } from 'preact/hooks';
import type { Category } from '../../domain/category.ts';
import {
  calculateExpenseByCategory,
  type CategoryExpense,
} from '../../domain/summary/byCategory.ts';
import { calculateMonthlySummary, type MonthlySummary } from '../../domain/summary/monthly.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { listTransactionsByDateRange } from '../../db/repositories/transactions.ts';
import { endOfMonth, startOfMonth, toDateString, type DateString } from '../../lib/date.ts';
import { formatYen } from '../../lib/money.ts';
import { hashFromPath } from '../../router/index.ts';
import { ExpenseByCategoryChart } from './ExpenseByCategoryChart.tsx';
import './dashboard.css';

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
  /** 今日の日付。テストで日付を決めるときに渡す。 */
  today?: DateString;
};

type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'loaded';
      summary: MonthlySummary;
      expenses: CategoryExpense[];
      categories: Category[];
    };

function monthLabel(month: DateString): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}

/** 差額が正なら `+` を付ける。負なら `formatYen` が `-` を付ける。 */
function signedYen(amount: number): string {
  return amount > 0 ? `+${formatYen(amount)}` : formatYen(amount);
}

/** ダッシュボード画面。今月の収入・支出・差額と、カテゴリ別の支出の円グラフを出す。 */
export function Dashboard({ dbName, today: todayProp }: Props) {
  const [month] = useState(() => startOfMonth(todayProp ?? toDateString(new Date())));
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      try {
        const db = await opening;
        const [transactions, categories] = await Promise.all([
          listTransactionsByDateRange(db, month, endOfMonth(month)),
          listCategories(db),
        ]);
        const summary = calculateMonthlySummary(transactions, month);
        const expenses = calculateExpenseByCategory(transactions, month);
        if (!cancelled) setState({ status: 'loaded', summary, expenses, categories });
      } catch {
        if (!cancelled) setState({ status: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close()).catch(() => {});
    };
  }, [dbName, month]);

  function body() {
    if (state.status === 'loading') return <p>読み込み中…</p>;
    if (state.status === 'failed') return <p>今月の収支を読み込めませんでした。</p>;
    const { income, expense, balance } = state.summary;
    const balanceKind = balance > 0 ? 'income' : balance < 0 ? 'expense' : 'zero';
    return (
      <dl class="dashboard-summary">
        <div class="dashboard-summary-item">
          <dt>収入</dt>
          <dd class="dashboard-amount dashboard-amount-income">{formatYen(income)}</dd>
        </div>
        <div class="dashboard-summary-item">
          <dt>支出</dt>
          <dd class="dashboard-amount dashboard-amount-expense">{formatYen(expense)}</dd>
        </div>
        <div class="dashboard-summary-item">
          <dt>差額</dt>
          <dd class={`dashboard-amount dashboard-amount-${balanceKind}`}>{signedYen(balance)}</dd>
        </div>
      </dl>
    );
  }

  return (
    <>
      <h2>ダッシュボード</h2>
      <section class="dashboard-section" aria-labelledby="dashboard-month-heading">
        <h3 id="dashboard-month-heading">{monthLabel(month)}の収支</h3>
        {body()}
        <p>
          <a href={hashFromPath('/transactions')}>今月の取引を見る</a>
        </p>
      </section>
      {state.status === 'loaded' && (
        <section class="dashboard-section" aria-labelledby="dashboard-by-category-heading">
          <h3 id="dashboard-by-category-heading">カテゴリ別の支出</h3>
          <ExpenseByCategoryChart expenses={state.expenses} categories={state.categories} />
        </section>
      )}
    </>
  );
}
