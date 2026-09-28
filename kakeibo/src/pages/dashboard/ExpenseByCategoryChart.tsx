import type { ChartData, ChartOptions } from 'chart.js';
import { useMemo } from 'preact/hooks';
import { Chart, readToken } from '../../components/charts/index.ts';
import type { Category } from '../../domain/category.ts';
import type { CategoryExpense } from '../../domain/summary/byCategory.ts';
import { formatYen, sumYen } from '../../lib/money.ts';

type Props = {
  /** カテゴリごとの支出の合計。並んでいる順に出す。 */
  expenses: readonly CategoryExpense[];
  categories: readonly Category[];
};

const missingName = '（削除済み）';

type Slice = { name: string; color: string; total: number; percent: number };

/** 支出全体に占める割合を、整数の百分率にする。 */
function percentOf(total: number, all: number): number {
  return all === 0 ? 0 : Math.round((total / all) * 100);
}

/**
 * カテゴリ別の支出を円グラフで出し、その下にカテゴリ・金額・割合の一覧を添える。
 * 色はカテゴリの表示色を使う。消されたカテゴリは「（削除済み）」の名前と `--color-text-muted` の色で出す。
 */
export function ExpenseByCategoryChart({ expenses, categories }: Props) {
  const slices = useMemo<Slice[]>(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const all = sumYen(expenses.map((e) => e.total));
    const missingColor = readToken('--color-text-muted');
    return expenses.map(({ categoryId, total }) => {
      const category = byId.get(categoryId);
      return {
        name: category?.name ?? missingName,
        color: category?.color ?? missingColor,
        total,
        percent: percentOf(total, all),
      };
    });
  }, [expenses, categories]);

  const data = useMemo<ChartData<'pie'>>(
    () => ({
      labels: slices.map((s) => s.name),
      datasets: [
        {
          data: slices.map((s) => s.total),
          backgroundColor: slices.map((s) => s.color),
          borderColor: readToken('--color-bg'),
        },
      ],
    }),
    [slices],
  );

  const options = useMemo<ChartOptions<'pie'>>(
    () => ({
      plugins: {
        // 凡例は下の一覧が受け持つ。
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${formatYen(item.parsed)}（${slices[item.dataIndex]!.percent}%）`,
          },
        },
      },
    }),
    [slices],
  );

  if (slices.length === 0) return <p>今月の支出はまだありません。</p>;

  return (
    <div class="expense-by-category">
      <Chart type="pie" label="カテゴリ別の支出の円グラフ" data={data} options={options} />
      <ul class="expense-by-category-list" aria-label="カテゴリ別の支出">
        {slices.map((slice, i) => (
          <li key={i} class="expense-by-category-item">
            <span
              class="expense-by-category-swatch"
              style={{ backgroundColor: slice.color }}
              aria-hidden="true"
            />
            <span class="expense-by-category-name">{slice.name}</span>
            <span class="expense-by-category-amount">{formatYen(slice.total)}</span>
            <span class="expense-by-category-percent">{slice.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
