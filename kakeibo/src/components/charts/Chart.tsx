import ChartJS from 'chart.js/auto';
import type { ChartData, ChartOptions, ChartType } from 'chart.js';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { readToken } from './tokens.ts';
import './chart.css';

export type ChartProps<T extends ChartType = ChartType> = {
  /** グラフの種類（`bar`・`line`・`doughnut` など）。 */
  type: T;
  data: ChartData<T>;
  options?: ChartOptions<T>;
  /** グラフが何を表すか。canvas の `aria-label` にする。 */
  label: string;
  /** canvas を描けないときと、支援技術に向けて出す中身（数値の表など）。 */
  children?: ComponentChildren;
};

/** 文字の色・書体と罫線の色を、tokens.css に合わせる。 */
function applyTokenDefaults() {
  const color = readToken('--color-text-muted');
  const fontFamily = readToken('--font-family');
  const borderColor = readToken('--color-border');
  if (color) ChartJS.defaults.color = color;
  if (fontFamily) ChartJS.defaults.font.family = fontFamily;
  if (borderColor) ChartJS.defaults.borderColor = borderColor;
}

function withDefaults<T extends ChartType>(options: ChartOptions<T> | undefined): ChartOptions<T> {
  // 高さは外側の要素で決め、幅は親に合わせて伸び縮みさせる。
  return { responsive: true, maintainAspectRatio: false, ...options } as ChartOptions<T>;
}

/**
 * Chart.js でグラフを描く共通コンポーネント。
 * `data` と `options` が変わると描き直し、`type` が変わると作り直す。外すと破棄する。
 */
export function Chart<T extends ChartType>({
  type,
  data,
  options,
  label,
  children,
}: ChartProps<T>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS<T> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    applyTokenDefaults();
    const chart = new ChartJS<T>(canvas, { type, data, options: withDefaults(options) });
    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
    // data と options の変化は、下の effect で作り直さずに反映する。
  }, [type]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data = data;
    chart.options = withDefaults(options);
    chart.update();
  }, [data, options]);

  return (
    <div class="chart">
      <canvas ref={canvasRef} role="img" aria-label={label}>
        {children}
      </canvas>
    </div>
  );
}
