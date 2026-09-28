import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { deleteCategory, listCategories } from '../../db/repositories/categories.ts';
import { addTransaction } from '../../db/repositories/transactions.ts';
import { AnnualReport } from './AnnualReport.tsx';

const testDbName = 'kakeibo-annual-report-test';

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

function renderPage(today: string) {
  render(<AnnualReport dbName={testDbName} today={today} />, document.body);
}

/** 表の行を、セルの文字の並びで返す。見出しの行と合計の行も含む。 */
function tableRows(table: Element): string[][] {
  return [...table.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th, td')].map((cell) => cell.textContent ?? ''),
  );
}

function tableOf(heading: string): Element | null {
  const section = [...document.querySelectorAll('.annual-report-section')].find(
    (s) => s.querySelector('h3')?.textContent === heading,
  );
  return section?.querySelector('table') ?? null;
}

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll('button')].find((b) => b.textContent === label)!;
}

const zeros = (n: number) => Array.from({ length: n }, () => '0');

test('その年の収入と支出を、カテゴリ × 月の表で出す', async () => {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const cash = await addAccount(db, { name: '現金', type: 'cash', initialBalance: 0 });
  const categories = await listCategories(db);
  const food = categories.find((c) => c.name === '食費')!;
  const daily = categories.find((c) => c.name === '日用品')!;
  const salary = categories.find((c) => c.type === 'income')!;
  const base = { accountId: bank.id, memo: '' };
  await addTransaction(db, {
    ...base,
    date: '2026-01-10',
    amount: 1200,
    type: 'expense',
    categoryId: daily.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-01-05',
    amount: 3000,
    type: 'expense',
    categoryId: food.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-12-31',
    amount: 2000,
    type: 'expense',
    categoryId: food.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-02-25',
    amount: 250000,
    type: 'income',
    categoryId: salary.id,
  });
  // ほかの年の取引と振替は数えない
  await addTransaction(db, {
    ...base,
    date: '2025-12-31',
    amount: 9,
    type: 'expense',
    categoryId: food.id,
  });
  await addTransaction(db, {
    ...base,
    date: '2026-03-01',
    amount: 30000,
    type: 'transfer',
    toAccountId: cash.id,
  });
  db.close();

  renderPage('2026-09-28');
  const expense = await waitFor(() => tableOf('支出'));
  const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

  expect(document.querySelector('.annual-report-year-label')?.textContent).toBe('2026年');
  expect(tableRows(expense)).toEqual([
    ['カテゴリ', ...months, '合計'],
    ['食費', '3,000', ...zeros(10), '2,000', '5,000'],
    ['日用品', '1,200', ...zeros(11), '1,200'],
    ['合計', '4,200', ...zeros(10), '2,000', '6,200'],
  ]);
  expect(tableRows(tableOf('収入')!)).toEqual([
    ['カテゴリ', ...months, '合計'],
    [salary.name, '0', '250,000', ...zeros(10), '250,000'],
    ['合計', '0', '250,000', ...zeros(10), '250,000'],
  ]);
});

test('消されたカテゴリの行は「（削除済み）」の名前で出す', async () => {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const food = (await listCategories(db)).find((c) => c.name === '食費')!;
  await addTransaction(db, {
    accountId: bank.id,
    memo: '',
    date: '2026-04-01',
    amount: 500,
    type: 'expense',
    categoryId: food.id,
  });
  await deleteCategory(db, food.id);
  db.close();

  renderPage('2026-09-28');
  const expense = await waitFor(() => tableOf('支出'));
  const name = expense.querySelector('tbody th')!;

  expect(name.textContent).toBe('（削除済み）');
  expect(name.classList.contains('annual-report-missing')).toBe(true);
});

test('取引の無い年は、表の代わりに文言を出す', async () => {
  renderPage('2026-09-28');
  await waitFor(() => document.querySelector('.annual-report-section'));

  expect(document.querySelector('table')).toBeNull();
  expect(
    [...document.querySelectorAll('.annual-report-section p')].map((p) => p.textContent),
  ).toEqual(['2026年の支出はまだありません。', '2026年の収入はまだありません。']);
});

test('前年・翌年で年を切り替え、今年でなければ URL のクエリに残す', async () => {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const food = (await listCategories(db)).find((c) => c.name === '食費')!;
  await addTransaction(db, {
    accountId: bank.id,
    memo: '',
    date: '2025-06-15',
    amount: 700,
    type: 'expense',
    categoryId: food.id,
  });
  db.close();
  window.location.hash = '#/reports';

  renderPage('2026-09-28');
  await waitFor(() => document.querySelector('.annual-report-section'));
  expect(tableOf('支出')).toBeNull();

  await act(() => button('前年').click());
  const expense = await waitFor(() => tableOf('支出'));
  expect(document.querySelector('.annual-report-year-label')?.textContent).toBe('2025年');
  expect(expense.querySelector('tfoot .annual-report-total')?.textContent).toBe('700');
  expect(window.location.hash).toBe('#/reports?year=2025');

  await act(() => button('翌年').click());
  await waitFor(() => (tableOf('支出') ? null : document.querySelector('.annual-report-section')));
  expect(window.location.hash).toBe('#/reports');
});

test('URL のクエリの年を開く', async () => {
  window.location.hash = '#/reports?year=2024';
  renderPage('2026-09-28');
  await waitFor(() => document.querySelector('.annual-report-section'));

  expect(document.querySelector('.annual-report-year-label')?.textContent).toBe('2024年');
});
