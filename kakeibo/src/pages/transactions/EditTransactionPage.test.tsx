import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { ToastProvider } from '../../components/Toast/index.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { addTransaction, getTransaction } from '../../db/repositories/transactions.ts';
import { EditTransactionPage } from './EditTransactionPage.tsx';

const testDbName = 'kakeibo-edit-transaction-page-test';

afterEach(async () => {
  render(null, document.body);
  document.body.innerHTML = '';
  window.location.hash = '';
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

/** 口座を2つと、支出の取引を1件入れる。 */
async function setup() {
  const db = await openKakeiboDB(testDbName);
  const cash = await addAccount(db, { name: '現金', type: 'cash', initialBalance: 0 });
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const categories = await listCategories(db);
  const expense = categories.filter((c) => c.type === 'expense');
  const transaction = await addTransaction(db, {
    date: '2026-09-10',
    amount: 800,
    type: 'expense',
    categoryId: expense[0]!.id,
    accountId: bank.id,
    memo: 'ランチ',
  });
  db.close();
  return { cash, bank, expense, transaction };
}

function renderPage(id: string) {
  render(
    <ToastProvider>
      <EditTransactionPage id={id} dbName={testDbName} />
    </ToastProvider>,
    document.body,
  );
}

test('取引の値をフォームに入れて出す', async () => {
  const { bank, expense, transaction } = await setup();
  renderPage(transaction.id);
  const form = await waitFor(() => document.querySelector('form'));
  const value = (name: string) =>
    form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!.value;

  expect(document.querySelector('h2')?.textContent).toBe('取引の編集');
  expect(value('date')).toBe('2026-09-10');
  expect(value('amount')).toBe('800');
  expect(form.querySelector<HTMLInputElement>('[name="type"]:checked')?.value).toBe('expense');
  expect(value('categoryId')).toBe(expense[0]!.id);
  expect(value('accountId')).toBe(bank.id);
  expect(value('memo')).toBe('ランチ');
});

test('直した内容で取引を置き換え、取引の一覧に戻る', async () => {
  const { cash, expense, transaction } = await setup();
  renderPage(transaction.id);
  const form = await waitFor(() => document.querySelector('form'));
  const field = <T extends HTMLElement>(name: string) => form.querySelector<T>(`[name="${name}"]`)!;

  await act(() => {
    const amount = field<HTMLInputElement>('amount');
    amount.value = '1,200';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    const category = field<HTMLSelectElement>('categoryId');
    category.value = expense[1]!.id;
    category.dispatchEvent(new Event('change', { bubbles: true }));
    const account = field<HTMLSelectElement>('accountId');
    account.value = cash.id;
    account.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  const check = await openKakeiboDB(testDbName);
  const saved = await waitFor(async () => {
    const found = await getTransaction(check, transaction.id);
    return found?.amount === 1200 ? found : null;
  });
  check.close();
  expect(saved).toEqual({
    id: transaction.id,
    date: '2026-09-10',
    amount: 1200,
    type: 'expense',
    categoryId: expense[1]!.id,
    accountId: cash.id,
    memo: 'ランチ',
  });
  expect(window.location.hash).toBe('#/transactions');
});

test('id の取引が無ければ、見つからない旨を出す', async () => {
  await setup();
  renderPage('missing');
  const message = await waitFor(() =>
    [...document.querySelectorAll('p')].find((p) =>
      p.textContent?.startsWith('取引が見つかりません'),
    ),
  );
  expect(message).toBeDefined();
  expect(document.querySelector('form')).toBeNull();
});

test('振替の取引では、フォームを出さずにまだ編集できない旨を出す', async () => {
  const { cash, bank } = await setup();
  const db = await openKakeiboDB(testDbName);
  const transfer = await addTransaction(db, {
    date: '2026-09-11',
    amount: 30000,
    type: 'transfer',
    accountId: bank.id,
    toAccountId: cash.id,
    memo: '',
  });
  db.close();

  renderPage(transfer.id);
  const message = await waitFor(() =>
    [...document.querySelectorAll('p')].find((p) => p.textContent?.includes('まだ編集できません')),
  );
  expect(message).toBeDefined();
  expect(document.querySelector('form')).toBeNull();
});
