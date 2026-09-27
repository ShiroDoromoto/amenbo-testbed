/** 1ページ分の項目と、ページ送りに要る数。 */
export type Page<T> = {
  items: T[];
  /** 出しているページ。1 から数える。 */
  page: number;
  pageCount: number;
  /** 出している項目が、全体の何件目から何件目か。1 から数え、両端を含む。 */
  first: number;
  last: number;
  total: number;
};

/**
 * `items` を `pageSize` 件ずつに分け、`page` ページ目を返す。
 * `page` がページの数を超えていたら最後のページを、1 より小さければ最初のページを返す。
 * 項目が無くても、1ページとして数える。
 */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page)), pageCount);
  const start = (current - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return {
    items: pageItems,
    page: current,
    pageCount,
    first: pageItems.length === 0 ? 0 : start + 1,
    last: start + pageItems.length,
    total: items.length,
  };
}
