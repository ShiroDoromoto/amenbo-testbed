import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { ConfirmDialog, type ConfirmDialogProps } from './index.ts';

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
});

function renderDialog(props: Partial<ConfirmDialogProps> = {}) {
  const root = document.createElement('div');
  document.body.append(root);
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const all: ConfirmDialogProps = {
    open: true,
    title: '取引を削除しますか？',
    children: <p>この操作は取り消せません。</p>,
    onConfirm,
    onCancel,
    ...props,
  };
  act(() => {
    render(<ConfirmDialog {...all} />, root);
  });
  const rerender = (next: Partial<ConfirmDialogProps>) =>
    act(() => {
      render(<ConfirmDialog {...all} {...next} />, root);
    });
  return { root, onConfirm, onCancel, rerender };
}

function dialog(root: HTMLElement) {
  return root.querySelector<HTMLElement>('[role="alertdialog"]');
}

function button(root: HTMLElement, label: string) {
  return [...root.querySelectorAll('button')].find((el) => el.textContent === label)!;
}

function press(key: string, options: KeyboardEventInit = {}) {
  act(() => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }),
    );
  });
}

test('open が false なら何も出さない', () => {
  const { root } = renderDialog({ open: false });
  expect(dialog(root)).toBeNull();
});

test('見出しと説明を、ダイアログの名前と説明として結びつける', () => {
  const { root } = renderDialog();
  const el = dialog(root)!;
  expect(el.getAttribute('aria-modal')).toBe('true');
  expect(document.getElementById(el.getAttribute('aria-labelledby')!)!.textContent).toBe(
    '取引を削除しますか？',
  );
  expect(document.getElementById(el.getAttribute('aria-describedby')!)!.textContent).toBe(
    'この操作は取り消せません。',
  );
});

test('説明が無ければ aria-describedby を付けない', () => {
  const { root } = renderDialog({ children: undefined });
  expect(dialog(root)!.hasAttribute('aria-describedby')).toBe(false);
});

test('ボタンの文言は既定で「キャンセル」と「OK」、渡せば差し替わる', () => {
  const { root, rerender } = renderDialog();
  expect([...root.querySelectorAll('button')].map((el) => el.textContent)).toEqual([
    'キャンセル',
    'OK',
  ]);
  rerender({ confirmLabel: '削除する', cancelLabel: 'やめる' });
  expect([...root.querySelectorAll('button')].map((el) => el.textContent)).toEqual([
    'やめる',
    '削除する',
  ]);
});

test('確定ボタンで onConfirm、キャンセルボタンで onCancel を呼ぶ', () => {
  const { root, onConfirm, onCancel } = renderDialog();
  act(() => button(root, 'OK').click());
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onCancel).not.toHaveBeenCalled();
  act(() => button(root, 'キャンセル').click());
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('Escape キーで onCancel を呼ぶ', () => {
  const { onCancel } = renderDialog();
  press('Escape');
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('背景を押すと onCancel を呼び、ダイアログの中を押しても呼ばない', () => {
  const { root, onCancel } = renderDialog();
  act(() => dialog(root)!.click());
  expect(onCancel).not.toHaveBeenCalled();
  act(() => root.querySelector<HTMLElement>('.confirm-dialog-backdrop')!.click());
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('danger なら確定ボタンを危険の色にする', () => {
  const { root, rerender } = renderDialog();
  expect(button(root, 'OK').classList.contains('confirm-dialog-danger')).toBe(false);
  rerender({ danger: true });
  expect(button(root, 'OK').classList.contains('confirm-dialog-danger')).toBe(true);
});

test('開くとキャンセルにフォーカスを置き、閉じると元の場所へ戻す', () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const { root, rerender } = renderDialog({ open: false });
  rerender({ open: true });
  expect(document.activeElement).toBe(button(root, 'キャンセル'));
  rerender({ open: false });
  expect(document.activeElement).toBe(opener);
});

test('Tab でフォーカスをダイアログの中で回す', () => {
  const { root } = renderDialog();
  const cancel = button(root, 'キャンセル');
  const ok = button(root, 'OK');
  act(() => ok.focus());
  press('Tab');
  expect(document.activeElement).toBe(cancel);
  press('Tab', { shiftKey: true });
  expect(document.activeElement).toBe(ok);
});

test('説明に置いた入力欄も、Tab で回るフォーカスの輪に入れる', () => {
  const { root } = renderDialog({
    children: (
      <label>
        付け替え先
        <select>
          <option>食費</option>
        </select>
      </label>
    ),
  });
  const select = root.querySelector('select')!;
  const ok = button(root, 'OK');
  act(() => ok.focus());
  press('Tab');
  expect(document.activeElement).toBe(select);
  press('Tab', { shiftKey: true });
  expect(document.activeElement).toBe(ok);
});

test('中の文字を押してフォーカスがダイアログにあっても、Escape と Tab が効く', () => {
  const { root, onCancel } = renderDialog();
  const el = dialog(root)!;
  expect(el.tabIndex).toBe(-1);
  act(() => el.focus());
  press('Tab');
  expect(document.activeElement).toBe(button(root, 'キャンセル'));
  act(() => el.focus());
  press('Tab', { shiftKey: true });
  expect(document.activeElement).toBe(button(root, 'OK'));
  act(() => el.focus());
  press('Escape');
  expect(onCancel).toHaveBeenCalledTimes(1);
});
