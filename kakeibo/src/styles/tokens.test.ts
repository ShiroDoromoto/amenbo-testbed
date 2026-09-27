import { expect, test } from 'vitest';
import tokens from './tokens.css?raw';

const sheets = import.meta.glob<string>('../**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function definedNames(css: string): Set<string> {
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!));
}

test('色・余白・文字サイズのトークンを定義する', () => {
  const names = [...definedNames(tokens)];
  expect(names.some((n) => n.startsWith('--color-'))).toBe(true);
  expect(names.some((n) => n.startsWith('--space-'))).toBe(true);
  expect(names.some((n) => n.startsWith('--font-size-'))).toBe(true);
});

test('CSS が参照する変数は、どれも tokens.css に定義がある', () => {
  const defined = definedNames(tokens);
  const undefinedRefs = Object.entries(sheets).flatMap(([path, css]) =>
    [...css.matchAll(/var\(\s*(--[\w-]+)/g)]
      .map((m) => m[1]!)
      .filter((name) => !defined.has(name))
      .map((name) => `${path}: ${name}`),
  );
  expect(undefinedRefs).toEqual([]);
});
