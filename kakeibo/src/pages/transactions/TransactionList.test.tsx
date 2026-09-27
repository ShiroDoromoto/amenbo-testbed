import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount, deleteAccount } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { addTransaction } from '../../db/repositories/transactions.ts';
import { TransactionList } from './TransactionList.tsx';

const testDbName = 'kakeibo-transaction-list-test';

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

function renderPage() {
  render(<TransactionList dbName={testDbName} />, document.body);
}

async function rows() {
  const list = await waitFor(() => document.querySelector('.transaction-list'));
  return [...list.querySelectorAll<HTMLAnchorElement>('a')];
}

const text = (row: HTMLElement, name: string) =>
  row.querySelector(`.transaction-list-${name}`)?.textContent;

/** 口座を2つと、収入・支出・振替の取引を1件ずつ、日付をばらばらに入れる。 */
async function setup() {
  const db = await openKakeiboDB(testDbName);
  const cash = await addAccount(db, { name: '現金', type: 'cash', initialBalance: 0 });
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const categories = await listCategories(db);
  const expense = categories.find((c) => c.type === 'expense')!;
  const income = categories.find((c) => c.type === 'income')!;
  const lunch = await addTransaction(db, {
    date: '2026-09-10',
    amount: 800,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: 'ランチ',
  });
  const salary = await addTransaction(db, {
    date: '2026-09-25',
    amount: 250000,
    type: 'income',
    categoryId: income.id,
    accountId: bank.id,
    memo: '',
  });
  const withdrawal = await addTransaction(db, {
    date: '2026-09-01',
    amount: 30000,
    type: 'transfer',
    accountId: bank.id,
    toAccountId: cash.id,
    memo: '',
  });
  db.close();
  return { cash, bank, expense, income, lunch, salary, withdrawal };
}

test('取引を日付の新しい順に並べ、それぞれ編集画面へのリンクにする', async () => {
  const { lunch, salary, withdrawal } = await setup();
  renderPage();
  const links = await rows();

  expect(links.map((a) => text(a, 'date'))).toEqual(['2026-09-25', '2026-09-10', '2026-09-01']);
  expect(links.map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${salary.id}`,
    `#/transactions/${lunch.id}`,
    `#/transactions/${withdrawal.id}`,
  ]);
});

test('収入・支出はカテゴリと口座を、振替は振替元と振替先を出す', async () => {
  const { expense, income } = await setup();
  renderPage();
  const [salary, lunch, withdrawal] = await rows();

  expect(text(salary!, 'title')).toBe(income.name);
  expect(text(salary!, 'amount')).toBe('+250,000円');
  expect(text(salary!, 'detail')).toBe('銀行');

  expect(text(lunch!, 'title')).toBe(expense.name);
  expect(text(lunch!, 'amount')).toBe('-800円');
  expect(text(lunch!, 'detail')).toBe('現金 ・ ランチ');

  expect(text(withdrawal!, 'title')).toBe('振替');
  expect(text(withdrawal!, 'amount')).toBe('30,000円');
  expect(text(withdrawal!, 'detail')).toBe('銀行 → 現金');
});

test('消された口座は「（削除済み）」と出す', async () => {
  const { cash } = await setup();
  const db = await openKakeiboDB(testDbName);
  await deleteAccount(db, cash.id);
  db.close();
  renderPage();
  const [, lunch] = await rows();

  expect(text(lunch!, 'detail')).toBe('（削除済み） ・ ランチ');
});

test('取引が無ければ、その旨と入力画面へのリンクを出す', async () => {
  renderPage();
  const message = await waitFor(() =>
    [...document.querySelectorAll('p')].find((p) =>
      p.textContent?.includes('取引はまだありません'),
    ),
  );

  expect(message.querySelector('a')?.getAttribute('href')).toBe('#/transactions/new');
  expect(document.querySelector('.transaction-list')).toBeNull();
});
