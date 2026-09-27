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
