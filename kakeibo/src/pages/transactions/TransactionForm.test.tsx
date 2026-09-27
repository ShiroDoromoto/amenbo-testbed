import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast/index.ts';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import { TransactionForm } from './TransactionForm.tsx';

const categories: Category[] = [
  { id: 'food', name: '食費', type: 'expense', color: '#ff0000', order: 0 },
  { id: 'salary', name: '給与', type: 'income', color: '#00ff00', order: 1 },
];

const accounts: Account[] = [
  { id: 'cash', name: '現金', type: 'cash', initialBalance: 0 },
  { id: 'bank', name: '銀行', type: 'bank', initialBalance: 0 },
];

afterEach(() => {
  render(null, document.body.firstElementChild!);
  document.body.innerHTML = '';
});

function renderForm(onSubmit = vi.fn(), accountList: Account[] = accounts) {
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <ToastProvider>
      <TransactionForm
        categories={categories}
        accounts={accountList}
        initialDate="2026-09-28"
        onSubmit={onSubmit}
      />
    </ToastProvider>,
    root,
  );
  const form = root.querySelector('form')!;
  const field = <T extends HTMLElement>(name: string) => form.querySelector<T>(`[name="${name}"]`)!;
  return { root, form, field, onSubmit };
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function choose(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

test('日付・収支・金額・カテゴリ・口座・メモの欄を出す', () => {
  const { field } = renderForm();
  expect(field<HTMLInputElement>('date').value).toBe('2026-09-28');
  expect(field<HTMLInputElement>('type').value).toBe('expense');
  for (const name of ['amount', 'categoryId', 'accountId', 'memo']) {
    expect(field(name)).not.toBeNull();
  }
});

function optionLabels(select: HTMLSelectElement) {
  return [...select.options].map((o) => o.textContent);
}

test('選んだ収支区分のカテゴリと、口座を選択肢に出す', () => {
  const { field } = renderForm();
  expect(optionLabels(field('categoryId'))).toEqual(['選んでください', '食費']);
  expect(optionLabels(field('accountId'))).toEqual(['現金', '銀行']);
});

test('収支区分を切り替えると、カテゴリの選択肢も切り替わり、選び直しになる', async () => {
  const { form, field } = renderForm();
  await act(() => choose(field('categoryId'), 'food'));
  await act(() => form.querySelector<HTMLInputElement>('input[value="income"]')!.click());
  expect(optionLabels(field('categoryId'))).toEqual(['選んでください', '給与']);
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');

  await act(() => form.querySelector<HTMLInputElement>('input[value="expense"]')!.click());
  expect(optionLabels(field('categoryId'))).toEqual(['選んでください', '食費']);
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');
});

test('収支区分を切り替えたあと、前の区分のカテゴリのままでは渡さない', async () => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    type(field('amount'), '500');
    choose(field('categoryId'), 'food');
  });
  await act(() => form.querySelector<HTMLInputElement>('input[value="income"]')!.click());
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
});

test('入力した内容を取引にして渡す', async () => {
  const { form, field, onSubmit } = renderForm();
  // 収入のカテゴリは、収支区分を収入にしてから選択肢に出る。
  await act(() => form.querySelector<HTMLInputElement>('input[value="income"]')!.click());
  await act(() => {
    type(field('date'), '2026-09-01');
    type(field('amount'), '１,２３４円');
    choose(field('categoryId'), 'salary');
    choose(field('accountId'), 'bank');
    type(field('memo'), ' 9月分 ');
  });
  await submit(form);
  expect(onSubmit).toHaveBeenCalledWith({
    date: '2026-09-01',
    amount: 1234,
    type: 'income',
    categoryId: 'salary',
    accountId: 'bank',
    memo: '9月分',
  });
});

test('金額が読めないときは渡さない', async () => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    type(field('amount'), 'abc');
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
});

test.each(['0', '-500'])('金額が %s 円のときは渡さない', async (amount) => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    type(field('amount'), amount);
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
});

test('口座が無いときは渡さない', async () => {
  const { form, field, onSubmit } = renderForm(vi.fn(), []);
  expect(field<HTMLSelectElement>('accountId').required).toBe(true);
  await act(() => {
    type(field('amount'), '500');
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
});

function errorOf(form: HTMLFormElement, name: string): string | null {
  const control = form.querySelector(`[name="${name}"]`)!;
  const errorId = control.getAttribute('aria-describedby');
  return errorId ? (document.getElementById(errorId)?.textContent ?? null) : null;
}

test('何も入れずに保存すると、金額とカテゴリにエラーを出し、金額の欄に移る', async () => {
  const { form, field, onSubmit } = renderForm();
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(errorOf(form, 'amount')).toBe('金額を入れてください');
  expect(errorOf(form, 'categoryId')).toBe('カテゴリを選んでください');
  expect(errorOf(form, 'date')).toBeNull();
  expect(errorOf(form, 'accountId')).toBeNull();
  expect(field('amount').getAttribute('aria-invalid')).toBe('true');
  expect(field('date').hasAttribute('aria-invalid')).toBe(false);
  expect(document.activeElement).toBe(field('amount'));
});

test('日付を消して保存すると、日付にエラーを出す', async () => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    type(field('date'), '');
    type(field('amount'), '500');
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(errorOf(form, 'date')).toBe('日付を入れてください');
  expect(document.activeElement).toBe(field('date'));
});

test('金額が正でなければ、そのことをエラーで出す', async () => {
  const { form, field } = renderForm();
  await act(() => {
    type(field('amount'), '0');
    choose(field('categoryId'), 'food');
  });
  await submit(form);
  expect(errorOf(form, 'amount')).toBe('金額は1円以上にしてください');
});

test('エラーを出したあと、欄を直すとその欄のエラーが消える', async () => {
  const { form, field } = renderForm();
  await submit(form);
  await act(() => {
    type(field('amount'), '500');
  });
  expect(errorOf(form, 'amount')).toBeNull();
  expect(errorOf(form, 'categoryId')).toBe('カテゴリを選んでください');
  await act(() => {
    choose(field('categoryId'), 'food');
  });
  expect(errorOf(form, 'categoryId')).toBeNull();
});

test('保存を押すまでは、エラーを出さない', async () => {
  const { form, field } = renderForm();
  await act(() => {
    type(field('amount'), 'abc');
  });
  expect(form.querySelector('.transaction-form-error')).toBeNull();
});

async function fillValid(form: HTMLFormElement, field: <T extends HTMLElement>(name: string) => T) {
  // 収支を変えるとカテゴリの選択肢が描き直されるので、先に切り替えておく。
  await act(() => {
    form.querySelector<HTMLInputElement>('input[value="income"]')!.click();
  });
  await act(() => {
    type(field('date'), '2026-09-01');
    type(field('amount'), '500');
    choose(field('categoryId'), 'salary');
    choose(field('accountId'), 'bank');
    type(field('memo'), '9月分');
  });
}

test('保存できたら、フォームを初めの状態に戻し、トーストで知らせる', async () => {
  const { form, field, onSubmit } = renderForm();
  await fillValid(form, field);
  await submit(form);
  expect(onSubmit).toHaveBeenCalledOnce();
  expect(field<HTMLInputElement>('date').value).toBe('2026-09-28');
  expect(form.querySelector<HTMLInputElement>('input[value="expense"]')!.checked).toBe(true);
  expect(field<HTMLInputElement>('amount').value).toBe('');
  expect(field<HTMLSelectElement>('categoryId').value).toBe('');
  expect(field<HTMLSelectElement>('accountId').value).toBe('cash');
  expect(field<HTMLInputElement>('memo').value).toBe('');
  expect(form.querySelector('.transaction-form-error')).toBeNull();
  expect(document.querySelector('[role="status"]')?.textContent).toContain('保存しました');
});

test('保存できなかったら、入力を残し、エラーのトーストを出す', async () => {
  const onSubmit = vi.fn().mockRejectedValue(new Error('書けない'));
  const { form, field } = renderForm(onSubmit);
  await fillValid(form, field);
  await submit(form);
  expect(field<HTMLInputElement>('amount').value).toBe('500');
  expect(field<HTMLInputElement>('memo').value).toBe('9月分');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('保存できませんでした');
  expect(document.querySelector('[role="status"]')).toBeNull();
});
