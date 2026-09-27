import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DEFAULT_TOAST_DURATION, ToastProvider, useToast, type ToastApi } from './index.ts';

let api: ToastApi;

function Capture() {
  api = useToast();
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function renderProvider() {
  const root = document.createElement('div');
  document.body.append(root);
  act(() => {
    render(
      <ToastProvider>
        <Capture />
      </ToastProvider>,
      root,
    );
  });
  return root;
}

function messages(root: HTMLElement) {
  return [...root.querySelectorAll('.toast-message')].map((el) => el.textContent);
}

test('出したトーストを、出した順に並べる', () => {
  const root = renderProvider();
  act(() => {
    api.show('保存しました');
    api.show('もう一件');
  });
  expect(messages(root)).toEqual(['保存しました', 'もう一件']);
});

test('既定の時間が過ぎると消える', () => {
  const root = renderProvider();
  act(() => {
    api.show('保存しました');
  });
  act(() => {
    vi.advanceTimersByTime(DEFAULT_TOAST_DURATION - 1);
  });
  expect(messages(root)).toEqual(['保存しました']);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(messages(root)).toEqual([]);
});

test('duration が 0 なら、時間が過ぎても消えない', () => {
  const root = renderProvider();
  act(() => {
    api.show('残る', { duration: 0 });
  });
  act(() => {
    vi.advanceTimersByTime(DEFAULT_TOAST_DURATION * 10);
  });
  expect(messages(root)).toEqual(['残る']);
});

test('閉じるボタンを押すと、そのトーストだけ消える', () => {
  const root = renderProvider();
  act(() => {
    api.show('一件目');
    api.show('二件目');
  });
  act(() => {
    root.querySelector<HTMLButtonElement>('.toast button[aria-label="閉じる"]')!.click();
  });
  expect(messages(root)).toEqual(['二件目']);
});

test('dismiss に id を渡すと消える', () => {
  const root = renderProvider();
  act(() => {
    const id = api.show('消す');
    api.dismiss(id);
  });
  expect(messages(root)).toEqual([]);
});

test('エラーは role="alert"、それ以外は role="status" で出す', () => {
  const root = renderProvider();
  act(() => {
    api.show('保存しました', { kind: 'success' });
    api.show('保存できませんでした', { kind: 'error' });
  });
  const toasts = [...root.querySelectorAll('.toast')];
  expect(
    toasts.map((el) => [el.getAttribute('role'), el.classList.contains('toast-error')]),
  ).toEqual([
    ['status', false],
    ['alert', true],
  ]);
});

test('ToastProvider の外で useToast を使うと投げる', () => {
  const root = document.createElement('div');
  document.body.append(root);
  expect(() => render(<Capture />, root)).toThrow('ToastProvider');
});
