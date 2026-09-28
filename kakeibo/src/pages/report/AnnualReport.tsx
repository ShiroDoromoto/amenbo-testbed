import { useEffect, useState } from 'preact/hooks';
import type { Category } from '../../domain/category.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { listTransactionsByDateRange } from '../../db/repositories/transactions.ts';
import { toDateString, type DateString } from '../../lib/date.ts';
import { queryFromHash, replaceHashQuery } from '../../router/index.ts';
import {
  calculateAnnualReport,
  REPORT_MONTHS,
  type AnnualReport as Report,
  type AnnualReportTable,
} from './calculateAnnualReport.ts';
import { readReportYear, writeReportYear } from './reportQuery.ts';
import './annualReport.css';

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
  /** 今日の日付。テストで日付を決めるときに渡す。 */
  today?: DateString;
};

type State =
  | { status: 'loading' }
  | { status: 'failed'; year: number }
  | { status: 'loaded'; year: number; report: Report; categories: Category[] };

const MIN_YEAR = 0;
const MAX_YEAR = 9999;

const missingName = '（削除済み）';

const amountFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });

/** 表の金額。単位は表の上に書くので、「円」は付けない。 */
function formatAmount(amount: number): string {
  return amountFormat.format(amount === 0 ? 0 : amount);
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0');
}

const monthNumbers = Array.from({ length: REPORT_MONTHS }, (_, i) => i + 1);

/**
 * 年間レポート画面。1年分の収入と支出を、カテゴリ × 月の表で出す。
 * 出す年は URL のクエリ `year` に持たせ、今年なら書かない。
 */
export function AnnualReport({ dbName, today: todayProp }: Props) {
  const [today] = useState(() => todayProp ?? toDateString(new Date()));
  const [year, setYear] = useState(() =>
    readReportYear(queryFromHash(window.location.hash), today),
  );
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    replaceHashQuery(writeReportYear(year, today));
  }, [today, year]);

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      try {
        const db = await opening;
        const [transactions, categories] = await Promise.all([
          listTransactionsByDateRange(db, `${pad(year, 4)}-01-01`, `${pad(year, 4)}-12-31`),
          listCategories(db),
        ]);
        const report = calculateAnnualReport(transactions, categories, year);
        if (!cancelled) setState({ status: 'loaded', year, report, categories });
      } catch {
        if (!cancelled) setState({ status: 'failed', year });
      }
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close()).catch(() => {});
    };
  }, [dbName, year]);

  function table(
    kind: 'income' | 'expense',
    title: string,
    data: AnnualReportTable,
    categories: readonly Category[],
  ) {
    const headingId = `annual-report-${kind}-heading`;
    const captionId = `annual-report-${kind}-caption`;
    const byId = new Map(categories.map((c) => [c.id, c]));
    return (
      <section class="annual-report-section" aria-labelledby={headingId}>
        <h3 id={headingId}>{title}</h3>
        {data.rows.length === 0 ? (
          <p>
            {year}年の{title}はまだありません。
          </p>
        ) : (
          // 幅が足りなければ、表だけを横にスクロールする。キーボードでもスクロールできるよう、フォーカスを受ける。
          <div class="annual-report-scroll" role="region" aria-labelledby={captionId} tabIndex={0}>
            <table class={`annual-report-table annual-report-table-${kind}`}>
              <caption id={captionId}>
                {year}年の{title}（単位：円）
              </caption>
              <thead>
                <tr>
                  <th scope="col">カテゴリ</th>
                  {monthNumbers.map((m) => (
                    <th key={m} scope="col">
                      {m}月
                    </th>
                  ))}
                  <th scope="col">合計</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const category = byId.get(row.categoryId);
                  return (
                    <tr key={row.categoryId}>
                      <th scope="row" class={category ? undefined : 'annual-report-missing'}>
                        {category?.name ?? missingName}
                      </th>
                      {row.months.map((amount, i) => (
                        <td key={i} class={amount === 0 ? 'annual-report-zero' : undefined}>
                          {formatAmount(amount)}
                        </td>
                      ))}
                      <td class="annual-report-total">{formatAmount(row.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">合計</th>
                  {data.months.map((amount, i) => (
                    <td key={i}>{formatAmount(amount)}</td>
                  ))}
                  <td class="annual-report-total">{formatAmount(data.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    );
  }

  function body() {
    // 年を切り替えた直後は、前の年の表を出さない。
    if (state.status === 'loading' || state.year !== year) return <p>読み込み中…</p>;
    if (state.status === 'failed') return <p>{year}年の収支を読み込めませんでした。</p>;
    return (
      <>
        {table('expense', '支出', state.report.expense, state.categories)}
        {table('income', '収入', state.report.income, state.categories)}
      </>
    );
  }

  return (
    <>
      <h2>年間レポート</h2>
      <nav class="annual-report-year" aria-label="表示する年">
        <button type="button" disabled={year <= MIN_YEAR} onClick={() => setYear(year - 1)}>
          前年
        </button>
        <span class="annual-report-year-label" aria-live="polite">
          {year}年
        </span>
        <button type="button" disabled={year >= MAX_YEAR} onClick={() => setYear(year + 1)}>
          翌年
        </button>
      </nav>
      {body()}
    </>
  );
}
