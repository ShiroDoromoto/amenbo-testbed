import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { addRecurringTransaction } from '../../db/repositories/recurring.ts';
import { RecurringList } from './RecurringList.tsx';

const testDbName = 'kakeibo-recurring-list-test';

afterEach(async () => {
  render(null, document.body);
  document.body.innerHTML = '';
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

function renderPage() {
  render(<RecurringList dbName={testDbName} />, document.body);
}

const text = (row: HTMLElement, name: string) =>
  row.querySelector(`.recurring-list-${name}`)?.textContent;

test('定期取引を毎月の日の早い順に出し、押すと編集画面を開く', async () => {
  const db = await openKakeiboDB(testDbName);
  const cash = await addAccount(db, { name: '現金', type: 'cash', initialBalance: 0 });
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const categories = await listCategories(db);
  const expense = categories.find((c) => c.type === 'expense')!;
  const income = categories.find((c) => c.type === 'income')!;
  const rent = await addRecurringTransaction(db, {
    dayOfMonth: 27,
    amount: 80000,
    type: 'expense',
    categoryId: expense.id,
    accountId: bank.id,
    memo: '家賃',
  });
  await addRecurringTransaction(db, {
    dayOfMonth: 25,
    amount: 250000,
    type: 'income',
    categoryId: income.id,
    accountId: bank.id,
    memo: '',
  });
  await addRecurringTransaction(db, {
    dayOfMonth: 1,
    amount: 30000,
    type: 'transfer',
    accountId: bank.id,
    toAccountId: cash.id,
    memo: '',
  });
  db.close();

  renderPage();
  const list = await waitFor(() => document.querySelector('.recurring-list'));
  const rows = [...list.querySelectorAll<HTMLAnchorElement>('a')];

  expect(rows.map((row) => text(row, 'day'))).toEqual(['毎月1日', '毎月25日', '毎月27日']);
  expect(rows.map((row) => text(row, 'title'))).toEqual(['振替', income.name, expense.name]);
  expect(rows.map((row) => text(row, 'amount'))).toEqual(['30,000円', '+250,000円', '-80,000円']);
  expect(rows.map((row) => text(row, 'detail'))).toEqual(['銀行 → 現金', '銀行', '銀行 ・ 家賃']);
  expect(rows[2]!.getAttribute('href')).toBe(`#/recurring/${rent.id}`);
});

test('定期取引が無ければ、無い旨と追加への案内を出す', async () => {
  renderPage();
  await waitFor(() =>
    [...document.querySelectorAll('p')].find((p) => p.textContent === '定期取引はまだありません。'),
  );
  const add = [...document.querySelectorAll('a')].find(
    (a) => a.textContent === '定期取引を追加する',
  );
  expect(add?.getAttribute('href')).toBe('#/recurring/new');
});
