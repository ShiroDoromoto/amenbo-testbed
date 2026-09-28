import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

type Config = { type: string; data: unknown; options: Record<string, unknown> };

const instances: { config: Config; data: unknown }[] = [];
const destroy = vi.fn();
const update = vi.fn();

vi.mock('chart.js/auto', () => {
  class FakeChart {
    static defaults = { color: '', borderColor: '', font: { family: '' } };
    data: unknown;
    options: unknown;
    config: Config;
    constructor(
      public canvas: HTMLCanvasElement,
      config: Config,
    ) {
      this.config = config;
      this.data = config.data;
      this.options = config.options;
      instances.push(this);
    }
    update = update;
    destroy = destroy;
  }
  return { default: FakeChart };
});

const { Chart } = await import('./index.ts');
const ChartJS = (await import('chart.js/auto')).default;

const data = { labels: ['1月', '2月'], datasets: [{ label: '支出', data: [100, 200] }] };

beforeEach(() => {
  instances.length = 0;
  destroy.mockClear();
  update.mockClear();
});

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
});

function renderChart(props: Parameters<typeof Chart>[0]) {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => {
    render(<Chart {...props} />, root);
  });
  const rerender = (next: Parameters<typeof Chart>[0]) =>
    act(() => {
      render(<Chart {...next} />, root);
    });
  return { root, rerender };
}

test('canvas にグラフを描き、label を aria-label にする', () => {
  const { root } = renderChart({ type: 'bar', data, label: '月ごとの支出' });
  const canvas = root.querySelector('canvas')!;
  expect(canvas.getAttribute('role')).toBe('img');
  expect(canvas.getAttribute('aria-label')).toBe('月ごとの支出');
  expect(instances).toHaveLength(1);
  expect(instances[0]!.config.type).toBe('bar');
  expect(instances[0]!.config.data).toBe(data);
});

test('既定で親の大きさに合わせ、渡した options を重ねる', () => {
  renderChart({ type: 'bar', data, label: 'グラフ', options: { indexAxis: 'y' } });
  expect(instances[0]!.config.options).toEqual({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
  });
});

test('children を canvas の中に置く', () => {
  const { root } = renderChart({
    type: 'bar',
    data,
    label: 'グラフ',
    children: <p>1月 100円、2月 200円</p>,
  });
  expect(root.querySelector('canvas p')?.textContent).toBe('1月 100円、2月 200円');
});

test('data が変わると、作り直さずに描き直す', () => {
  const { rerender } = renderChart({ type: 'bar', data, label: 'グラフ' });
  update.mockClear();
  const next = { labels: ['3月'], datasets: [{ label: '支出', data: [300] }] };
  rerender({ type: 'bar', data: next, label: 'グラフ' });
  expect(instances).toHaveLength(1);
  expect(instances[0]!.data).toBe(next);
  expect(update).toHaveBeenCalledTimes(1);
  expect(destroy).not.toHaveBeenCalled();
});

test('type が変わると、前のグラフを破棄して作り直す', () => {
  const { rerender } = renderChart({ type: 'bar', data, label: 'グラフ' });
  rerender({ type: 'line', data, label: 'グラフ' });
  expect(destroy).toHaveBeenCalledTimes(1);
  expect(instances).toHaveLength(2);
  expect(instances[1]!.config.type).toBe('line');
});

test('外すとグラフを破棄する', () => {
  renderChart({ type: 'bar', data, label: 'グラフ' });
  act(() => {
    render(null, document.body.firstElementChild!);
  });
  expect(destroy).toHaveBeenCalledTimes(1);
});

test('文字と罫線の色・書体を tokens.css の変数から取る', () => {
  const style = document.documentElement.style;
  style.setProperty('--color-text-muted', '#59636e');
  style.setProperty('--color-border', '#dddddd');
  style.setProperty('--font-family', 'system-ui, sans-serif');
  renderChart({ type: 'bar', data, label: 'グラフ' });
  expect(ChartJS.defaults.color).toBe('#59636e');
  expect(ChartJS.defaults.borderColor).toBe('#dddddd');
  expect(ChartJS.defaults.font.family).toBe('system-ui, sans-serif');
});
