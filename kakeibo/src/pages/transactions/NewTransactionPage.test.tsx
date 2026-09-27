import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { listTransactionsByDateRange } from '../../db/repositories/transactions.ts';
import { NewTransactionPage } from './NewTransactionPage.tsx';

const testDbName = 'kakeibo-new-transaction-page-test';

afterEach(async () => {
  render(null, document.body);
  document.body.innerHTML = '';
  await deleteDB(testDbName);
});

async function waitFor<T>(
  find: () => T | null | undefined | Promise<T | null | undefined>,
): Promise<T> {
  for (let i = 0; i < 100; i++) {
    const found = await find();
    if (found) return found;
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  }
  throw new Error('待っても出てこなかった');
}

test('入力した取引を DB に足す', async () => {
  const setup = await openKakeiboDB(testDbName);
  const account = await addAccount(setup, { name: '現金', type: 'cash', initialBalance: 0 });
  setup.close();

  render(<NewTransactionPage dbName={testDbName} />, document.body);
  const form = await waitFor(() => document.querySelector('form'));
  const field = <T extends HTMLElement>(name: string) => form.querySelector<T>(`[name="${name}"]`)!;

  // 既定のカテゴリ（初回起動時に登録されるもの）から1つ選ぶ。
  const category = field<HTMLSelectElement>('categoryId').options[1]!;
  await act(() => {
    const date = field<HTMLInputElement>('date');
    date.value = '2026-09-10';
    date.dispatchEvent(new Event('input', { bubbles: true }));
    const amount = field<HTMLInputElement>('amount');
    amount.value = '800';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    const select = field<HTMLSelectElement>('categoryId');
    select.value = category.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  const check = await openKakeiboDB(testDbName);
  const transactions = await waitFor(async () => {
    const found = await listTransactionsByDateRange(check, '2026-09-10', '2026-09-10');
    return found.length > 0 ? found : null;
  });
  check.close();
  expect(transactions).toMatchObject([
    {
      date: '2026-09-10',
      amount: 800,
      type: 'expense',
      categoryId: category.value,
      accountId: account.id,
      memo: '',
    },
  ]);
});
