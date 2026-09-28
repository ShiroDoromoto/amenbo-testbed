import { useEffect, useId, useState } from 'preact/hooks';
import type { Category } from '../../domain/category.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { listTransactionsByDateRange } from '../../db/repositories/transactions.ts';
import { toDateString, type DateString } from '../../lib/date.ts';
import { queryFromHash, replaceHashQuery } from '../../router/index.ts';
import {
  calculateReport,
  yearPeriod,
  type Report,
  type ReportPeriod,
  type ReportTable,
} from './calculateReport.ts';
import {
  periodOf,
  readReportSelection,
  validateReportRange,
  writeReportSelection,
  yearOf,
  type ReportRangeErrors,
  type ReportSelection,
} from './reportQuery.ts';
import './reportPage.css';

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
  /** 今日の日付。テストで日付を決めるときに渡す。 */
  today?: DateString;
};

type State =
  | { status: 'loading' }
  | { status: 'failed'; period: ReportPeriod }
  | { status: 'loaded'; period: ReportPeriod; report: Report; categories: Category[] };

const MIN_YEAR = 0;
const MAX_YEAR = 9999;

const missingName = '（削除済み）';

const amountFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });

/** 表の金額。単位は表の上に書くので、「円」は付けない。 */
function formatAmount(amount: number): string {
  return amountFormat.format(amount === 0 ? 0 : amount);
}

/** `2025-04-01` → `2025年4月1日` */
function formatDate(date: DateString): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}

/** 表の見出しと文言に使う、期間の名前。1年ごとなら `2025年`、指定した期間なら `2025年4月1日〜2026年3月31日`。 */
function selectionLabel(selection: ReportSelection): string {
  return selection.kind === 'year'
    ? `${selection.year}年`
    : `${formatDate(selection.from)}〜${formatDate(selection.to)}`;
}

/** 列の見出し。すべての列が同じ年なら月だけ、年をまたぐなら年も書く。 */
function monthLabels(months: readonly DateString[]): string[] {
  const sameYear = months.every((m) => m.slice(0, 4) === months[0]?.slice(0, 4));
  return months.map((m) => {
    const month = `${Number(m.slice(5, 7))}月`;
    return sameYear ? month : `${Number(m.slice(0, 4))}年${month}`;
  });
}

function samePeriod(a: ReportPeriod, b: ReportPeriod): boolean {
  return a.from === b.from && a.to === b.to;
}

/**
 * レポート画面。期間の収入と支出を、カテゴリ × 月の表で出す。
 * 期間は1年ごとに切り替えるか、開始日と終了日で指定する。
 * 期間は URL のクエリ（`year`、または `from` と `to`）に持たせ、今年を1年ごとに出すなら書かない。
 */
export function ReportPage({ dbName, today: todayProp }: Props) {
  const id = useId();
  const [today] = useState(() => todayProp ?? toDateString(new Date()));
  const [selection, setSelection] = useState(() =>
    readReportSelection(queryFromHash(window.location.hash), today),
  );
  const [draft, setDraft] = useState<ReportPeriod>(() => periodOf(selection));
  const [rangeErrors, setRangeErrors] = useState<ReportRangeErrors>({});
  const [state, setState] = useState<State>({ status: 'loading' });
  const period = periodOf(selection);
  const { from, to } = period;

  useEffect(() => {
    replaceHashQuery(writeReportSelection(selection, today));
  }, [today, selection]);

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    const period = { from, to };
    void (async () => {
      try {
        const db = await opening;
        const [transactions, categories] = await Promise.all([
          listTransactionsByDateRange(db, from, to),
          listCategories(db),
        ]);
        const report = calculateReport(transactions, categories, period);
        if (!cancelled) setState({ status: 'loaded', period, report, categories });
      } catch {
        if (!cancelled) setState({ status: 'failed', period });
      }
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close()).catch(() => {});
    };
  }, [dbName, from, to]);

  function chooseYearly() {
    if (selection.kind === 'year') return;
    setSelection({ kind: 'year', year: yearOf(selection.from) });
  }

  function chooseRange() {
    if (selection.kind === 'range') return;
    // 切り替えた時点では、いま出している年をそのまま期間にする。
    const next = yearPeriod(selection.year);
    setSelection({ kind: 'range', ...next });
    setDraft(next);
    setRangeErrors({});
  }

  function submitRange(event: Event) {
    event.preventDefault();
    const errors = validateReportRange(draft.from, draft.to);
    setRangeErrors(errors ?? {});
    if (errors) {
      document.getElementById(`${id}-${errors.from ? 'from' : 'to'}`)?.focus();
      return;
    }
    setSelection({ kind: 'range', ...draft });
  }

  function yearNav(year: number) {
    return (
      <nav class="report-year" aria-label="表示する年">
        <button
          type="button"
          disabled={year <= MIN_YEAR}
          onClick={() => setSelection({ kind: 'year', year: year - 1 })}
        >
          前年
        </button>
        <span class="report-year-label" aria-live="polite">
          {year}年
        </span>
        <button
          type="button"
          disabled={year >= MAX_YEAR}
          onClick={() => setSelection({ kind: 'year', year: year + 1 })}
        >
          翌年
        </button>
      </nav>
    );
  }

  function rangeField(field: 'from' | 'to', label: string) {
    const error = rangeErrors[field];
    return (
      <div class="report-range-field">
        <label for={`${id}-${field}`}>{label}</label>
        <input
          id={`${id}-${field}`}
          type="date"
          min="0000-01-01"
          max="9999-12-31"
          value={draft[field]}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={error !== undefined ? `${id}-${field}-error` : undefined}
          onInput={(e) => {
            const value = e.currentTarget.value;
            setDraft((d) => ({ ...d, [field]: value }));
          }}
        />
        {error !== undefined && (
          <p class="report-range-error" id={`${id}-${field}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  }

  function rangeForm() {
    return (
      <form class="report-range" aria-label="表示する期間" noValidate onSubmit={submitRange}>
        {rangeField('from', '開始日')}
        {rangeField('to', '終了日')}
        <button type="submit" class="report-range-submit">
          表示
        </button>
      </form>
    );
  }

  function table(
    kind: 'income' | 'expense',
    title: string,
    report: Report,
    data: ReportTable,
    categories: readonly Category[],
  ) {
    const headingId = `report-${kind}-heading`;
    const captionId = `report-${kind}-caption`;
    const byId = new Map(categories.map((c) => [c.id, c]));
    const label = selectionLabel(selection);
    return (
      <section class="report-section" aria-labelledby={headingId}>
        <h3 id={headingId}>{title}</h3>
        {data.rows.length === 0 ? (
          <p>
            {label}の{title}はまだありません。
          </p>
        ) : (
          // 幅が足りなければ、表だけを横にスクロールする。キーボードでもスクロールできるよう、フォーカスを受ける。
          <div class="report-scroll" role="region" aria-labelledby={captionId} tabIndex={0}>
            <table class={`report-table report-table-${kind}`}>
              <caption id={captionId}>
                {label}の{title}（単位：円）
              </caption>
              <thead>
                <tr>
                  <th scope="col">カテゴリ</th>
                  {monthLabels(report.months).map((m) => (
                    <th key={m} scope="col">
                      {m}
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
                      <th scope="row" class={category ? undefined : 'report-missing'}>
                        {category?.name ?? missingName}
                      </th>
                      {row.months.map((amount, i) => (
                        <td key={i} class={amount === 0 ? 'report-zero' : undefined}>
                          {formatAmount(amount)}
                        </td>
                      ))}
                      <td class="report-total">{formatAmount(row.total)}</td>
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
                  <td class="report-total">{formatAmount(data.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    );
  }

  function body() {
    // 期間を切り替えた直後は、前の期間の表を出さない。
    if (state.status === 'loading' || !samePeriod(state.period, period)) return <p>読み込み中…</p>;
    if (state.status === 'failed')
      return <p>{selectionLabel(selection)}の収支を読み込めませんでした。</p>;
    return (
      <>
        {table('expense', '支出', state.report, state.report.expense, state.categories)}
        {table('income', '収入', state.report, state.report.income, state.categories)}
      </>
    );
  }

  return (
    <>
      <h2>レポート</h2>
      <fieldset class="report-mode">
        <legend>期間の決め方</legend>
        <label>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={selection.kind === 'year'}
            onChange={chooseYearly}
          />
          1年ごと
        </label>
        <label>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={selection.kind === 'range'}
            onChange={chooseRange}
          />
          期間を指定
        </label>
      </fieldset>
      {selection.kind === 'year' ? yearNav(selection.year) : rangeForm()}
      {body()}
    </>
  );
}
