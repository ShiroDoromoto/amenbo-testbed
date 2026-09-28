import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { MonthlyTrendPoint } from '../../domain/summary/trend.ts';

type TooltipItem = { dataIndex: number; parsed: { y: number }; dataset: { label: string } };

type Config = {
  type: string;
  data: {
    labels: string[];
    datasets: { label: string; data: number[]; backgroundColor: string }[];
  };
  options: {
    scales: { y: { ticks: { callback: (value: number) => string } } };
    plugins: {
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

const { MonthlyTrendChart } = await import('./MonthlyTrendChart.tsx');

beforeEach(() => {
  configs.length = 0;
});

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
});

function point(month: string, income: number, expense: number): MonthlyTrendPoint {
  return { month, income, expense, balance: income - expense };
}

function renderChart(trend: MonthlyTrendPoint[]) {
  act(() => {
    render(<MonthlyTrendChart trend={trend} />, document.body);
  });
}

test('月ごとの収入と支出を、収支の色の棒グラフで描く', () => {
  document.documentElement.style.setProperty('--color-income', '#1a7f37');
  document.documentElement.style.setProperty('--color-expense', '#cf222e');
  renderChart([point('2025-12-01', 250000, 180000), point('2026-01-01', 0, 3000)]);

  expect(configs).toHaveLength(1);
  const config = configs[0]!;
  expect(config.type).toBe('bar');
  expect(config.data.labels).toEqual(['12月', '1月']);
  expect(config.data.datasets.map((d) => [d.label, d.data, d.backgroundColor])).toEqual([
    ['収入', [250000, 0], '#1a7f37'],
    ['支出', [180000, 3000], '#cf222e'],
  ]);
  expect(config.options.scales.y.ticks.callback(250000)).toBe('25万円');

  const { title, label } = config.options.plugins.tooltip.callbacks;
  const item = { dataIndex: 1, parsed: { y: 3000 }, dataset: { label: '支出' } };
  expect(title([item])).toBe('2026年1月');
  expect(label(item)).toBe(' 支出 3,000円');
  expect(document.querySelector('canvas')?.getAttribute('aria-label')).toBe(
    '月ごとの収入と支出の棒グラフ',
  );
});

test('canvas の中に、月ごとの収入・支出・差額の表を置く', () => {
  renderChart([point('2025-12-01', 250000, 180000), point('2026-01-01', 0, 3000)]);

  const rows = [...document.querySelectorAll('canvas tbody tr')].map((tr) =>
    [...tr.children].map((cell) => cell.textContent),
  );
  expect(rows).toEqual([
    ['2025年12月', '250,000円', '180,000円', '70,000円'],
    ['2026年1月', '0円', '3,000円', '-3,000円'],
  ]);
});

test('どの月にも取引が無ければ、グラフを描かずにそう書く', () => {
  renderChart([point('2025-12-01', 0, 0), point('2026-01-01', 0, 0)]);

  expect(configs).toHaveLength(0);
  expect(document.querySelector('canvas')).toBeNull();
  expect(document.body.textContent).toBe('この1年の取引はまだありません。');
});
