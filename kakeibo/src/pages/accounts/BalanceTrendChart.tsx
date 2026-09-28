import type { ChartData, ChartOptions } from 'chart.js';
import { useMemo } from 'preact/hooks';
import {
  Chart,
  compactYenLabel,
  longMonthLabel,
  readToken,
  shortMonthLabel,
} from '../../components/charts/index.ts';
import type { BalanceTrendPoint } from '../../domain/balance.ts';
import { formatYen } from '../../lib/money.ts';

type Props = {
  /** 月末の時点での残高の合計。古い月から並んでいる順に出す。 */
  trend: readonly BalanceTrendPoint[];
};

/**
 * すべての口座の残高の合計を、月末の時点ごとに折れ線グラフで出す。
 * 線の色は `--color-primary`。残高はマイナスにもなるので、縦軸は 0 から始めない。
 */
export function BalanceTrendChart({ trend }: Props) {
  const data = useMemo<ChartData<'line'>>(() => {
    const color = readToken('--color-primary');
    return {
      labels: trend.map((p) => shortMonthLabel(p.month)),
      datasets: [
        {
          label: '残高',
          data: trend.map((p) => p.balance),
          borderColor: color,
          backgroundColor: color,
        },
      ],
    };
  }, [trend]);

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      scales: {
        y: { ticks: { callback: (value) => compactYenLabel(Number(value)) } },
      },
      plugins: {
        // 系列が1本なので、凡例は出さない。
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `${longMonthLabel(trend[items[0]!.dataIndex]!.month)}末`,
            label: (item) => ` 残高 ${formatYen(item.parsed.y ?? 0)}`,
          },
        },
      },
    }),
    [trend],
  );

  return (
    <Chart type="line" label="月末の残高の推移の折れ線グラフ" data={data} options={options}>
      <table>
        <caption>月末の残高</caption>
        <thead>
          <tr>
            <th scope="col">月</th>
            <th scope="col">残高</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((p) => (
            <tr key={p.month}>
              <th scope="row">{longMonthLabel(p.month)}</th>
              <td>{formatYen(p.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Chart>
  );
}
