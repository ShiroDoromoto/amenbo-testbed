import type { ExpensePace } from '../../domain/summary/pace.ts';
import { formatYen } from '../../lib/money.ts';

type Props = {
  pace: ExpensePace;
  /** 何月の支出か。1〜12。 */
  monthNumber: number;
};

/**
 * 1日あたりの平均支出と、そのペースで使ったときの月末までの支出見込みを出す。
 * その下に、どの期間の支出から計算したかを添える。
 */
export function ExpensePaceSummary({ pace, monthNumber }: Props) {
  const { spent, elapsedDays, dailyAverage, projected } = pace;
  const period =
    elapsedDays === 1 ? `${monthNumber}月1日` : `${monthNumber}月1日〜${elapsedDays}日`;
  return (
    <>
      <dl class="expense-pace">
        <div class="expense-pace-item">
          <dt>1日あたりの平均</dt>
          <dd class="dashboard-amount">{formatYen(dailyAverage)}</dd>
        </div>
        <div class="expense-pace-item">
          <dt>月末までの見込み</dt>
          <dd class="dashboard-amount dashboard-amount-expense">{formatYen(projected)}</dd>
        </div>
      </dl>
      <p class="expense-pace-note">
        {period}（{elapsedDays}日間）の支出 {formatYen(spent)} から計算しています。
      </p>
    </>
  );
}
