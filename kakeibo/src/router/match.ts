export type RouteParams = Record<string, string>;

/**
 * パスがパターンに合うかを調べる。合えばパラメータを返し、合わなければ null を返す。
 * パターンの `:name` の区切りは、どの値にも合い、`params.name` に入る。
 * 例：`/transactions/:id` と `/transactions/42` → `{ id: '42' }`
 */
export function matchPath(pattern: string, path: string): RouteParams | null {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(path);
  if (patternParts.length !== pathParts.length) return null;

  const params: RouteParams = {};
  for (const [i, part] of patternParts.entries()) {
    const value = pathParts[i] ?? '';
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(value);
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

function splitPath(path: string): string[] {
  return path.split('/').filter((part) => part !== '');
}
