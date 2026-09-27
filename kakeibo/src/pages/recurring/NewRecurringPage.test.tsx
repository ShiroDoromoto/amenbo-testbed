import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { ToastProvider } from '../../components/Toast/index.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { listRecurringTransactions } from '../../db/repositories/recurring.ts';
import { NewRecurringPage } from './NewRecurringPage.tsx';

const testDbName = 'kakeibo-new-recurring-page-test';

afterEach(async () => {
  render(null, document.body);
  document.body.innerHTML = '';
  window.location.hash = '';
  await deleteDB(testDbName);
});

async function waitFor<T>(find: () => T | null | undefined): Promise<T> {
  for (let i = 0; i < 100; i++) {
    const found = find();
    if (found) return found;
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error('待っても出てこなかった');
}

test('入力した定期取引を足し、定期取引の一覧に戻る', async () => {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const expense = (await listCategories(db)).find((c) => c.type === 'expense')!;
  db.close();

  render(
    <ToastProvider>
      <NewRecurringPage dbName={testDbName} />
    </ToastProvider>,
    document.body,
  );
  const form = await waitFor(() => document.querySelector('form'));
  const field = <T extends HTMLElement>(name: string) => form.querySelector<T>(`[name="${name}"]`)!;
  expect(document.querySelector('h2')?.textContent).toBe('定期取引の追加');
  expect(field<HTMLSelectElement>('dayOfMonth').value).toBe(String(new Date().getDate()));

  await act(() => {
    const day = field<HTMLSelectElement>('dayOfMonth');
    day.value = '27';
    day.dispatchEvent(new Event('change', { bubbles: true }));
    const amount = field<HTMLInputElement>('amount');
    amount.value = '80,000';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    const category = field<HTMLSelectElement>('categoryId');
    category.value = expense.id;
    category.dispatchEvent(new Event('change', { bubbles: true }));
    const memo = field<HTMLInputElement>('memo');
    memo.value = ' 家賃 ';
    memo.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  await waitFor(() => window.location.hash === '#/recurring');
  const check = await openKakeiboDB(testDbName);
  const saved = await listRecurringTransactions(check);
  check.close();
  expect(saved).toEqual([
    {
      id: saved[0]!.id,
      dayOfMonth: 27,
      amount: 80000,
      type: 'expense',
      categoryId: expense.id,
      accountId: bank.id,
      memo: '家賃',
    },
  ]);
});

test('入力に誤りがあれば、足さずにエラーを出す', async () => {
  render(
    <ToastProvider>
      <NewRecurringPage dbName={testDbName} />
    </ToastProvider>,
    document.body,
  );
  const form = await waitFor(() => document.querySelector('form'));
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  const errors = [...form.querySelectorAll('.transaction-form-error')].map((p) => p.textContent);
  expect(errors).toEqual([
    '金額を入れてください',
    'カテゴリを選んでください',
    '口座を選んでください',
  ]);
  expect(document.activeElement?.getAttribute('name')).toBe('amount');
  expect(window.location.hash).toBe('');
});
