import { useEffect, useState } from 'preact/hooks';
import type { Category } from '../../domain/category.ts';
import {
  calculateExpenseByCategory,
  type CategoryExpense,
} from '../../domain/summary/byCategory.ts';
import {
  calculateMonthlyComparison,
  type MonthlyComparison,
} from '../../domain/summary/comparison.ts';
import { calculateMonthlyTrend, type MonthlyTrendPoint } from '../../domain/summary/trend.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { listTransactionsByDateRange } from '../../db/repositories/transactions.ts';
import {
  addMonths,
  endOfMonth,
  startOfMonth,
  toDateString,
  type DateString,
} from '../../lib/date.ts';
import { formatYen } from '../../lib/money.ts';
import { hashFromPath } from '../../router/index.ts';
import { ExpenseByCategoryChart } from './ExpenseByCategoryChart.tsx';
import { MonthComparison } from './MonthComparison.tsx';
import { MonthlyTrendChart } from './MonthlyTrendChart.tsx';
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
      comparison: MonthlyComparison;
      expenses: CategoryExpense[];
      categories: Category[];
      trend: MonthlyTrendPoint[];
    };

function monthLabel(month: DateString): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${year}年${monthNumber}月`;
}

/** 差額が正なら `+` を付ける。負なら `formatYen` が `-` を付ける。 */
function signedYen(amount: number): string {
  return amount > 0 ? `+${formatYen(amount)}` : formatYen(amount);
}

/**
 * ダッシュボード画面。今月の収入・支出・差額と、その前月比・前年同月比、
 * カテゴリ別の支出の円グラフ、直近 12 か月の収支の棒グラフを出す。
 */
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
          // 推移に使う 12 か月分と、その前の月（前年同月）の分をまとめて読む。
          // 今月の集計と比較は、その中から要る月の取引だけを数える。
          listTransactionsByDateRange(db, addMonths(month, -12), endOfMonth(month)),
          listCategories(db),
        ]);
        const comparison = calculateMonthlyComparison(transactions, month);
        const expenses = calculateExpenseByCategory(transactions, month);
        const trend = calculateMonthlyTrend(transactions, month);
        if (!cancelled) setState({ status: 'loaded', comparison, expenses, categories, trend });
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
    const { income, expense, balance } = state.comparison.current;
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
        <section class="dashboard-section" aria-labelledby="dashboard-comparison-heading">
          <h3 id="dashboard-comparison-heading">前月・前年同月との比較</h3>
          <MonthComparison comparison={state.comparison} />
        </section>
      )}
      {state.status === 'loaded' && (
        <section class="dashboard-section" aria-labelledby="dashboard-by-category-heading">
          <h3 id="dashboard-by-category-heading">カテゴリ別の支出</h3>
          <ExpenseByCategoryChart expenses={state.expenses} categories={state.categories} />
        </section>
      )}
      {state.status === 'loaded' && (
        <section class="dashboard-section" aria-labelledby="dashboard-trend-heading">
          <h3 id="dashboard-trend-heading">月ごとの収支の推移</h3>
          <MonthlyTrendChart trend={state.trend} />
        </section>
      )}
    </>
  );
}
