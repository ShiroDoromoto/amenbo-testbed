import { render } from 'preact';
import { afterEach, expect, test } from 'vitest';
import { App } from './App.tsx';

afterEach(() => {
  document.body.innerHTML = '';
});

test('ヘッダー・ナビ・本文の骨組みを出す', () => {
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  expect(root.querySelector('header h1')?.textContent).toBe('家計簿');
  expect(root.querySelectorAll('nav a').length).toBeGreaterThan(0);
  expect(root.querySelector('main')).not.toBeNull();
});
