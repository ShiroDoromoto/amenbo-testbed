import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test, vi } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { addTransaction } from '../../db/repositories/transactions.ts';

// jsdom の canvas では Chart.js が描けないので、描く部分を差し替える。
vi.mock('chart.js/auto', () => {
  class FakeChart {
    static defaults = { color: '', borderColor: '', font: { family: '' } };
    update() {}
    destroy() {}
  }
  return { default: FakeChart };
});

const { Dashboard } = await import('./Dashboard.tsx');

const testDbName = 'kakeibo-dashboard-test';

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

function renderPage(today: string) {
  render(<Dashboard dbName={testDbName} today={today} />, document.body);
}

/** 収入・支出・差額の名前と金額を、並んでいる順に返す。 */
function summaryRows(summary: Element) {
  return [...summary.querySelectorAll('.dashboard-summary-item')].map((item) => [
    item.querySelector('dt')?.textContent,
    item.querySelector('dd')?.textContent,
  ]);
}

test('今月の収入・支出・差額を出し、ほかの月の取引と振替は数えない', async () => {
  const db = await openKakeiboDB(testDbName);
  const cash = await addAccount(db, { name: '現金', type: 'cash', initialBalance: 0 });
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const categories = await listCategories(db);
  const expense = categories.find((c) => c.type === 'expense')!;
  const income = categories.find((c) => c.type === 'income')!;
  const base = { accountId: bank.id, memo: '' };
  await addTransaction(db, {
    ...base,
    date: '2026-09-25',
    amount: 250000,
    type: 'income',
    categoryId: income.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-09-01',
    amount: 80000,
    type: 'expense',
    categoryId: expense.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-09-30',
    amount: 1200,
    type: 'expense',
    categoryId: expense.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-08-31',
    amount: 5000,
    type: 'expense',
    categoryId: expense.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-10-01',
    amount: 9000,
    type: 'income',
    categoryId: income.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-09-10',
    amount: 30000,
    type: 'transfer',
    toAccountId: cash.id,
  });
  db.close();

  renderPage('2026-09-28');
  const summary = await waitFor(() => document.querySelector('.dashboard-summary'));

  expect(document.querySelector('h3')?.textContent).toBe('2026年9月の収支');
  expect(summaryRows(summary)).toEqual([
    ['収入', '250,000円'],
    ['支出', '81,200円'],
    ['差額', '+168,800円'],
  ]);
  expect(summary.querySelector('.dashboard-amount-income')?.textContent).toBe('250,000円');
});

test('支出が収入より多ければ、差額を負で支出の色にして出す', async () => {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const expense = (await listCategories(db)).find((c) => c.type === 'expense')!;
  await addTransaction(db, {
    date: '2026-09-05',
    amount: 3000,
    type: 'expense',
    categoryId: expense.id,
    accountId: bank.id,
    memo: '',
  });
  db.close();

  renderPage('2026-09-28');
  const summary = await waitFor(() => document.querySelector('.dashboard-summary'));
  const balance = summary.querySelectorAll('dd')[2]!;

  expect(balance.textContent).toBe('-3,000円');
  expect(balance.classList.contains('dashboard-amount-expense')).toBe(true);
});

test('今月の取引が無ければ、どれも 0円 で出す', async () => {
  renderPage('2026-01-15');
  const summary = await waitFor(() => document.querySelector('.dashboard-summary'));

  expect(document.querySelector('h3')?.textContent).toBe('2026年1月の収支');
  expect(summaryRows(summary)).toEqual([
    ['収入', '0円'],
    ['支出', '0円'],
    ['差額', '0円'],
  ]);
});

test('取引の一覧への案内を出す', () => {
  renderPage('2026-09-28');
  const link = [...document.querySelectorAll('a')].find(
    (a) => a.textContent === '今月の取引を見る',
  );
  expect(link?.getAttribute('href')).toBe('#/transactions');
});

test('今月の支出をカテゴリ別に、多い順で出す', async () => {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const [first, second] = (await listCategories(db)).filter((c) => c.type === 'expense');
  const base = { accountId: bank.id, memo: '', type: 'expense' as const };
  await addTransaction(db, { ...base, date: '2026-09-03', amount: 1000, categoryId: first!.id });
  await addTransaction(db, { ...base, date: '2026-09-04', amount: 3000, categoryId: second!.id });
  await addTransaction(db, { ...base, date: '2026-08-31', amount: 9000, categoryId: first!.id });
  db.close();

  renderPage('2026-09-28');
  const list = await waitFor(() => document.querySelector('.expense-by-category-list'));

  expect(document.querySelector('#dashboard-by-category-heading')?.textContent).toBe(
    'カテゴリ別の支出',
  );
  expect(document.querySelector('canvas')?.getAttribute('aria-label')).toBe(
    'カテゴリ別の支出の円グラフ',
  );
  expect(
    [...list.querySelectorAll('li')].map((li) => [
      li.querySelector('.expense-by-category-name')?.textContent,
      li.querySelector('.expense-by-category-amount')?.textContent,
    ]),
  ).toEqual([
    [second!.name, '3,000円'],
    [first!.name, '1,000円'],
  ]);
});

test('直近 12 か月の収支を、月ごとの棒グラフで出す', async () => {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const categories = await listCategories(db);
  const expense = categories.find((c) => c.type === 'expense')!;
  const income = categories.find((c) => c.type === 'income')!;
  const base = { accountId: bank.id, memo: '' };
  await addTransaction(db, {
    ...base,
    date: '2025-10-01',
    amount: 7000,
    type: 'expense',
    categoryId: expense.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2025-09-30',
    amount: 9000,
    type: 'expense',
    categoryId: expense.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-09-25',
    amount: 250000,
    type: 'income',
    categoryId: income.id,
  });
  db.close();

  renderPage('2026-09-28');
  const table = await waitFor(() => document.querySelector('canvas table'));

  expect(document.querySelector('#dashboard-trend-heading')?.textContent).toBe(
    '月ごとの収支の推移',
  );
  const rows = [...table.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.children].map((cell) => cell.textContent),
  );
  expect(rows).toHaveLength(12);
  expect(rows[0]).toEqual(['2025年10月', '0円', '7,000円', '-7,000円']);
  expect(rows[11]).toEqual(['2026年9月', '250,000円', '0円', '250,000円']);
});

test('今月の収支を、前月比と前年同月比で出す', async () => {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const categories = await listCategories(db);
  const expense = categories.find((c) => c.type === 'expense')!;
  const income = categories.find((c) => c.type === 'income')!;
  const base = { accountId: bank.id, memo: '' };
  const add = (date: string, amount: number, type: 'income' | 'expense') =>
    addTransaction(db, {
      ...base,
      date,
      amount,
      type,
      categoryId: (type === 'income' ? income : expense).id,
    });
  await add('2026-09-25', 250000, 'income');
  await add('2026-09-10', 90000, 'expense');
  await add('2026-08-31', 100000, 'expense');
  await add('2025-09-01', 60000, 'expense');
  db.close();

  renderPage('2026-09-28');
  const table = await waitFor(() => document.querySelector('.month-comparison'));

  expect(document.querySelector('#dashboard-comparison-heading')?.textContent).toBe(
    '前月・前年同月との比較',
  );
  expect(
    [...table.querySelectorAll('tr')].map((tr) =>
      [...tr.children].map(
        (cell) =>
          [...cell.querySelectorAll('span')].map((s) => s.textContent).join(' ') ||
          cell.textContent,
      ),
    ),
  ).toEqual([
    ['項目', '前月比', '前年同月比'],
    ['収入', '+250,000円 —', '+250,000円 —'],
    ['支出', '-10,000円 -10%', '+30,000円 +50%'],
    ['差額', '+260,000円 +260%', '+220,000円 +367%'],
  ]);
});
