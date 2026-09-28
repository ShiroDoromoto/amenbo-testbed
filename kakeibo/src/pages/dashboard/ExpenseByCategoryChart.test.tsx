import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Category } from '../../domain/category.ts';

type Config = {
  type: string;
  data: { labels: string[]; datasets: { data: number[]; backgroundColor: string[] }[] };
  options: {
    plugins: {
      legend: { display: boolean };
      tooltip: { callbacks: { label: (item: { parsed: number; dataIndex: number }) => string } };
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

const { ExpenseByCategoryChart } = await import('./ExpenseByCategoryChart.tsx');

const food: Category = { id: 'food', name: '食費', type: 'expense', color: '#e5534b', order: 0 };
const rent: Category = { id: 'rent', name: '住居', type: 'expense', color: '#539bf5', order: 1 };

beforeEach(() => {
  configs.length = 0;
});

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
});

function renderChart(props: Parameters<typeof ExpenseByCategoryChart>[0]) {
  act(() => {
    render(<ExpenseByCategoryChart {...props} />, document.body);
  });
}

function listRows() {
  return [...document.querySelectorAll('.expense-by-category-item')].map((item) =>
    [...item.querySelectorAll('span:not([aria-hidden])')].map((s) => s.textContent),
  );
}

test('カテゴリの名前と表示色で円グラフを描き、金額と割合の一覧を添える', () => {
  renderChart({
    expenses: [
      { categoryId: 'rent', total: 75000 },
      { categoryId: 'food', total: 25000 },
    ],
    categories: [food, rent],
  });

  expect(configs).toHaveLength(1);
  const config = configs[0]!;
  expect(config.type).toBe('pie');
  expect(config.data.labels).toEqual(['住居', '食費']);
  expect(config.data.datasets[0]!.data).toEqual([75000, 25000]);
  expect(config.data.datasets[0]!.backgroundColor).toEqual(['#539bf5', '#e5534b']);
  expect(config.options.plugins.legend.display).toBe(false);
  expect(config.options.plugins.tooltip.callbacks.label({ parsed: 25000, dataIndex: 1 })).toBe(
    ' 25,000円（25%）',
  );
  expect(document.querySelector('canvas')?.getAttribute('aria-label')).toBe(
    'カテゴリ別の支出の円グラフ',
  );
  expect(listRows()).toEqual([
    ['住居', '75,000円', '75%'],
    ['食費', '25,000円', '25%'],
  ]);
});

test('消されたカテゴリは「（削除済み）」と --color-text-muted の色で出す', () => {
  document.documentElement.style.setProperty('--color-text-muted', '#59636e');
  renderChart({ expenses: [{ categoryId: 'gone', total: 1200 }], categories: [food] });

  expect(configs[0]!.data.labels).toEqual(['（削除済み）']);
  expect(configs[0]!.data.datasets[0]!.backgroundColor).toEqual(['#59636e']);
  expect(listRows()).toEqual([['（削除済み）', '1,200円', '100%']]);
});

test('支出が無ければ、グラフを描かずにそう書く', () => {
  renderChart({ expenses: [], categories: [food] });

  expect(configs).toHaveLength(0);
  expect(document.querySelector('canvas')).toBeNull();
  expect(document.body.textContent).toBe('今月の支出はまだありません。');
});
