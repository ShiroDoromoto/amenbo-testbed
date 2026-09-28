import type { Category } from '../../domain/category.ts';
import type { CategoryExpense } from '../../domain/summary/byCategory.ts';
import { formatYen, sumYen } from '../../lib/money.ts';

type Props = {
  /** カテゴリごとの支出の合計。多い順に並んでいるものを渡す。 */
  expenses: readonly CategoryExpense[];
  categories: readonly Category[];
};

/** 出す件数。 */
const topCount = 5;

const missingName = '（削除済み）';

/**
 * 支出の多いカテゴリを、上から 5 件まで順位付きで出す。
 * 金額の横に、今月の支出全体に占める割合を添える。帯の長さは 1 位の金額を基準にする。
 * 消されたカテゴリは「（削除済み）」の名前と `--color-text-muted` の色で出す。
 */
export function TopExpenseCategories({ expenses, categories }: Props) {
  if (expenses.length === 0) return <p>今月の支出はまだありません。</p>;

  const byId = new Map(categories.map((c) => [c.id, c]));
  const all = sumYen(expenses.map((e) => e.total));
  const top = expenses.slice(0, topCount);
  const largest = top[0]!.total;

  return (
    <ol class="top-expense-categories" aria-label="支出の多いカテゴリ">
      {top.map(({ categoryId, total }, i) => {
        const category = byId.get(categoryId);
        return (
          <li key={categoryId} class="top-expense-categories-item">
            <span class="top-expense-categories-rank">{i + 1}</span>
            <span class="top-expense-categories-name">{category?.name ?? missingName}</span>
            <span class="top-expense-categories-amount">{formatYen(total)}</span>
            <span class="top-expense-categories-percent">{Math.round((total / all) * 100)}%</span>
            <span class="top-expense-categories-bar" aria-hidden="true">
              <span
                style={{
                  width: `${(total / largest) * 100}%`,
                  backgroundColor: category?.color ?? 'var(--color-text-muted)',
                }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
