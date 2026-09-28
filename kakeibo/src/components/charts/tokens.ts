/**
 * Chart.js は canvas に描くので、CSS の var(--…) を直に使えない。
 * 色や文字の値は、ここで tokens.css の変数を読んで渡す。
 */

/** tokens.css の変数の値を読む。定義が無ければ空文字を返す。 */
export function readToken(
  name: `--${string}`,
  element: Element = document.documentElement,
): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}
