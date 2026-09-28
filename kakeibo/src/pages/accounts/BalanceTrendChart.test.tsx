import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { BalanceTrendPoint } from '../../domain/balance.ts';

type TooltipItem = { dataIndex: number; parsed: { y: number } };

type Config = {
  type: string;
  data: {
    labels: string[];
    datasets: { label: string; data: number[]; borderColor: string }[];
  };
  options: {
    scales: { y: { beginAtZero?: boolean; ticks: { callback: (value: number) => string } } };
    plugins: {
      legend: { display: boolean };
      tooltip: {
        callbacks: {
          title: (items: TooltipItem[]) => string;
          label: (item: TooltipItem) => string;
        };
      };
    };
  };
};

const configs: Config[] = [];

vi.mock('chart.js/auto', () => {
  class FakeChart {
    static defaults = { color: '', borderColor: '', font: { family: '' } };
    constructor(_canvas: HTMLCanvasElement, config: Config) {
      configs.push(config);
    }
    update() {}
    destroy() {}
  }
  return { default: FakeChart };
});

const { BalanceTrendChart } = await import('./BalanceTrendChart.tsx');

beforeEach(() => {
  configs.length = 0;
});

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
});

function renderChart(trend: BalanceTrendPoint[]) {
  act(() => {
    render(<BalanceTrendChart trend={trend} />, document.body);
  });
}

const trend: BalanceTrendPoint[] = [
  { month: '2025-12-01', balance: 120000 },
  { month: '2026-01-01', balance: -30000 },
];

test('月末の残高を、主色の折れ線グラフで描く', () => {
  document.documentElement.style.setProperty('--color-primary', '#0b6bcb');
  renderChart(trend);

  expect(configs).toHaveLength(1);
  const config = configs[0]!;
  expect(config.type).toBe('line');
  expect(config.data.labels).toEqual(['12月', '1月']);
  expect(config.data.datasets.map((d) => [d.label, d.data, d.borderColor])).toEqual([
    ['残高', [120000, -30000], '#0b6bcb'],
  ]);
  expect(config.options.scales.y.beginAtZero).toBeUndefined();
  expect(config.options.scales.y.ticks.callback(-30000)).toBe('-3万円');
  expect(config.options.plugins.legend.display).toBe(false);

  const { title, label } = config.options.plugins.tooltip.callbacks;
  const item = { dataIndex: 1, parsed: { y: -30000 } };
  expect(title([item])).toBe('2026年1月末');
  expect(label(item)).toBe(' 残高 -30,000円');
  expect(document.querySelector('canvas')?.getAttribute('aria-label')).toBe(
    '月末の残高の推移の折れ線グラフ',
  );
});

test('canvas の中に、月末の残高の表を置く', () => {
  renderChart(trend);

  const rows = [...document.querySelectorAll('canvas tbody tr')].map((tr) =>
    [...tr.children].map((cell) => cell.textContent),
  );
  expect(rows).toEqual([
    ['2025年12月', '120,000円'],
    ['2026年1月', '-30,000円'],
  ]);
});
