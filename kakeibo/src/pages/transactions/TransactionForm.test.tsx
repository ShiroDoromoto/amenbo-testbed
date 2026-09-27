import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
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
  document.body.innerHTML = '';
});

function renderForm(onSubmit = vi.fn(), accountList: Account[] = accounts) {
  const root = document.createElement('div');
  document.body.append(root);
  render(
    <TransactionForm
      categories={categories}
      accounts={accountList}
      initialDate="2026-09-28"
      onSubmit={onSubmit}
    />,
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

test('カテゴリと口座を選択肢に出す', () => {
  const { field } = renderForm();
  const options = (name: string) =>
    [...field<HTMLSelectElement>(name).options].map((o) => o.textContent);
  expect(options('categoryId')).toEqual(['選んでください', '食費', '給与']);
  expect(options('accountId')).toEqual(['現金', '銀行']);
});

test('入力した内容を取引にして渡す', async () => {
  const { form, field, onSubmit } = renderForm();
  await act(() => {
    const income = form.querySelector<HTMLInputElement>('input[value="income"]')!;
    income.click();
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
