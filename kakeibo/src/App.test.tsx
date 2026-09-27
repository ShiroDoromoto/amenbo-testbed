import { render } from 'preact';
import { afterEach, expect, test } from 'vitest';
import { App } from './App.tsx';

afterEach(() => {
  document.body.innerHTML = '';
});

test('見出しを表示する', () => {
  const root = document.createElement('div');
  document.body.append(root);
  render(<App />, root);
  expect(root.querySelector('h1')?.textContent).toBe('家計簿');
});
