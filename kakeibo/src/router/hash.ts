/**
 * `location.hash` からパスを取り出す。
 * `#/transactions` → `/transactions`。空・`#`・`#/` はどれも `/` にする。
 * クエリ（`?` 以降）と末尾の `/` は落とす。
 */
export function pathFromHash(hash: string): string {
  const raw = hash.replace(/^#/, '').split('?')[0] ?? '';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.replace(/\/+$/, '') || '/';
}

/** パスから `href` に入れるハッシュを作る。`/transactions` → `#/transactions` */
export function hashFromPath(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

/** 画面を切り替える。`location.hash` を書き換えるので、`hashchange` が起きる */
export function navigate(path: string): void {
  window.location.hash = hashFromPath(path);
}

/** `location.hash` のクエリ（`?` 以降）を読む。`#/transactions?type=income` → `type=income` */
export function queryFromHash(hash: string): URLSearchParams {
  const index = hash.indexOf('?');
  return new URLSearchParams(index === -1 ? '' : hash.slice(index + 1));
}

/**
 * いまのパスはそのままに、ハッシュのクエリを置き換える。空ならクエリを外す。
 * 履歴を積まず、`hashchange` も起こさない。再読み込みしても残したい画面の状態を持たせるのに使う。
 */
export function replaceHashQuery(query: URLSearchParams): void {
  const search = query.toString();
  const hash = hashFromPath(pathFromHash(window.location.hash)) + (search ? `?${search}` : '');
  if (hash === window.location.hash) return;
  window.history.replaceState(window.history.state, '', hash);
}
