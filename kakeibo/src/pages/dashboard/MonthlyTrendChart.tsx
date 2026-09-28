import type { ChartData, ChartOptions } from 'chart.js';
import { useMemo } from 'preact/hooks';
import {
  Chart,
  compactYenLabel,
  longMonthLabel,
  readToken,
  shortMonthLabel,
} from '../../components/charts/index.ts';
import type { MonthlyTrendPoint } from '../../domain/summary/trend.ts';
import { formatYen } from '../../lib/money.ts';

type Props = {
  /** 月ごとの収支。古い月から並んでいる順に出す。 */
  trend: readonly MonthlyTrendPoint[];
};

/**
 * 月ごとの収入と支出を、並べた棒グラフで出す。
 * 収入は `--color-income`、支出は `--color-expense` の色にする。どの月にも取引が無ければ、グラフを描かない。
 */
export function MonthlyTrendChart({ trend }: Props) {
  const data = useMemo<ChartData<'bar'>>(
    () => ({
      labels: trend.map((p) => shortMonthLabel(p.month)),
      datasets: [
        {
          label: '収入',
          data: trend.map((p) => p.income),
          backgroundColor: readToken('--color-income'),
        },
        {
          label: '支出',
          data: trend.map((p) => p.expense),
          backgroundColor: readToken('--color-expense'),
        },
      ],
    }),
    [trend],
  );

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => compactYenLabel(Number(value)) },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => longMonthLabel(trend[items[0]!.dataIndex]!.month),
            label: (item) => ` ${item.dataset.label} ${formatYen(item.parsed.y ?? 0)}`,
          },
        },
      },
    }),
    [trend],
  );

  if (trend.every((p) => p.income === 0 && p.expense === 0)) {
    return <p>この1年の取引はまだありません。</p>;
  }

  return (
    <Chart type="bar" label="月ごとの収入と支出の棒グラフ" data={data} options={options}>
      <table>
        <caption>月ごとの収支</caption>
        <thead>
          <tr>
            <th scope="col">月</th>
            <th scope="col">収入</th>
            <th scope="col">支出</th>
            <th scope="col">差額</th>
          </tr>
        </thead>
        <tbody>
          {trend.map((p) => (
            <tr key={p.month}>
              <th scope="row">{longMonthLabel(p.month)}</th>
              <td>{formatYen(p.income)}</td>
              <td>{formatYen(p.expense)}</td>
              <td>{formatYen(p.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Chart>
  );
}
