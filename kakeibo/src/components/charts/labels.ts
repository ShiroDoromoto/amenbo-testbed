/** グラフの目盛りとツールチップに出す文言。 */

function splitMonth(month: string): [year: number, month: number] {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  return [year, monthNumber];
}

/** 軸の目盛り。狭い幅でも収まるよう、`YYYY-MM-DD` を「9月」のように月だけにする。 */
export function shortMonthLabel(month: string): string {
  return `${splitMonth(month)[1]}月`;
}

/** ツールチップと表に出す月。`YYYY-MM-DD` を「2026年9月」にする。 */
export function longMonthLabel(month: string): string {
  const [year, monthNumber] = splitMonth(month);
  return `${year}年${monthNumber}月`;
}

const compactNumber = new Intl.NumberFormat('ja-JP', { notation: 'compact' });

/** 縦軸の目盛り。「25万円」のように短くする。 */
export function compactYenLabel(value: number): string {
  return `${compactNumber.format(value)}円`;
}
