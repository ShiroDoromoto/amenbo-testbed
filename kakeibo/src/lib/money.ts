/** 金額（円）。安全に足し引きできる範囲の整数で持つ。 */
export type Yen = number;

export function isYen(value: unknown): value is Yen {
  return Number.isSafeInteger(value);
}

/** 全角の数字・記号を半角に揃える。 */
function toHalfWidth(text: string): string {
  return text.replace(/[０-９，－]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

const yenInputPattern = /^([-−])?[¥￥]?(\d{1,3}(?:,\d{3})+|\d+)円?$/;

/**
 * 入力された文字列を円の整数に直す。直せなければ `null` を返す。
 *
 * 前後の空白、3桁ごとのカンマ、先頭の `¥`・`￥`、末尾の `円`、全角の数字を受け付ける。
 * 小数や、カンマの位置が崩れたものは受け付けない。
 */
export function parseYen(input: string): Yen | null {
  const match = yenInputPattern.exec(toHalfWidth(input.trim()));
  const [, sign, digits] = match ?? [];
  if (digits === undefined) return null;
  const value = Number(digits.replaceAll(',', ''));
  if (!isYen(value)) return null;
  return sign && value !== 0 ? -value : value;
}

/** 金額を足し合わせる。整数でない値が混じっていたら例外を投げる。 */
export function sumYen(amounts: Iterable<Yen>): Yen {
  let total = 0;
  for (const amount of amounts) {
    if (!isYen(amount)) throw new RangeError(`金額が整数ではありません: ${amount}`);
    total += amount;
  }
  if (!isYen(total)) throw new RangeError(`合計が扱える範囲を超えました: ${total}`);
  return total;
}

const yenFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });

/** 表示用に書式を整える。例：`1234` → `1,234円`、`-500` → `-500円`。 */
export function formatYen(amount: Yen): string {
  // -0 を「-0円」と出さないよう、0 に揃える。
  return `${yenFormat.format(amount === 0 ? 0 : amount)}円`;
}
