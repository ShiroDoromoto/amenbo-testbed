import type { Change, MonthlyComparison } from '../../domain/summary/comparison.ts';
import { formatYen } from '../../lib/money.ts';

type Props = {
  comparison: MonthlyComparison;
};

const rows = [
  { key: 'income', label: '収入' },
  { key: 'expense', label: '支出' },
  { key: 'balance', label: '差額' },
] as const;

/** 増えていれば `+` を付ける。減っていれば `formatYen` が `-` を付ける。 */
function signedYen(amount: number): string {
  return amount > 0 ? `+${formatYen(amount)}` : formatYen(amount);
}

/** 割合を、符号付きの整数の百分率にする。割合が無ければ `—` にする。 */
function signedPercent(rate: number | null): string {
  if (rate === null) return '—';
  // -0.4% を「-0%」と出さないよう、0 に揃える。
  const percent = Math.round(rate * 100) || 0;
  return percent > 0 ? `+${percent}%` : `${percent}%`;
}

function ChangeCell({ change }: { change: Change }) {
  return (
    <td>
      <span class="month-comparison-difference">{signedYen(change.difference)}</span>
      <span class="month-comparison-rate">{signedPercent(change.rate)}</span>
    </td>
  );
}

/**
 * 今月の収入・支出・差額を、前月と前年同月から見た増減の表で出す。
 * 増減は金額と割合で書く。比べる元が 0円 のときは、割合を `—` にする。
 */
export function MonthComparison({ comparison }: Props) {
  return (
    <table class="month-comparison">
      <thead>
        <tr>
          <th scope="col">項目</th>
          <th scope="col">前月比</th>
          <th scope="col">前年同月比</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, label }) => (
          <tr key={key}>
            <th scope="row">{label}</th>
            <ChangeCell change={comparison.previousMonth[key]} />
            <ChangeCell change={comparison.previousYear[key]} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
