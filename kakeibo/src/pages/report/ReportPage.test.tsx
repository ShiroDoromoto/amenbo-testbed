import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { deleteCategory, listCategories } from '../../db/repositories/categories.ts';
import { addTransaction } from '../../db/repositories/transactions.ts';
import { ReportPage } from './ReportPage.tsx';

const testDbName = 'kakeibo-report-test';

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
  render(<ReportPage dbName={testDbName} today={today} />, document.body);
}

/** 表の行を、セルの文字の並びで返す。見出しの行と合計の行も含む。 */
function tableRows(table: Element): string[][] {
  return [...table.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('th, td')].map((cell) => cell.textContent ?? ''),
  );
}

function tableOf(heading: string): Element | null {
  const section = [...document.querySelectorAll('.report-section')].find(
    (s) => s.querySelector('h3')?.textContent === heading,
  );
  return section?.querySelector('table') ?? null;
}

function button(label: string): HTMLButtonElement {
  return [...document.querySelectorAll('button')].find((b) => b.textContent === label)!;
}

/** ラベルの文字から、ラジオボタンか日付の欄を探す。 */
function field(label: string): HTMLInputElement {
  const found = [...document.querySelectorAll('label')].find((l) => l.textContent === label)!;
  return (found.control ?? found.querySelector('input')) as HTMLInputElement;
}

async function type(input: HTMLInputElement, value: string) {
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** 食費の支出を `dates` の日付に 1 件ずつ入れる。金額は 1, 10, 100… と桁をずらす。 */
async function seedFood(dates: string[]) {
  const db = await openKakeiboDB(testDbName);
  const bank = await addAccount(db, { name: '銀行', type: 'bank', initialBalance: 0 });
  const food = (await listCategories(db)).find((c) => c.name === '食費')!;
  for (const [i, date] of dates.entries()) {
    await addTransaction(db, {
      accountId: bank.id,
      memo: '',
      date,
      amount: 10 ** i,
      type: 'expense',
      categoryId: food.id,
    });
  }
  db.close();
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

  expect(document.querySelector('.report-year-label')?.textContent).toBe('2026年');
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
  expect(name.classList.contains('report-missing')).toBe(true);
});

test('取引の無い年は、表の代わりに文言を出す', async () => {
  renderPage('2026-09-28');
  await waitFor(() => document.querySelector('.report-section'));

  expect(document.querySelector('table')).toBeNull();
  expect([...document.querySelectorAll('.report-section p')].map((p) => p.textContent)).toEqual([
    '2026年の支出はまだありません。',
    '2026年の収入はまだありません。',
  ]);
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
  await waitFor(() => document.querySelector('.report-section'));
  expect(tableOf('支出')).toBeNull();

  await act(() => button('前年').click());
  const expense = await waitFor(() => tableOf('支出'));
  expect(document.querySelector('.report-year-label')?.textContent).toBe('2025年');
  expect(expense.querySelector('tfoot .report-total')?.textContent).toBe('700');
  expect(window.location.hash).toBe('#/reports?year=2025');

  await act(() => button('翌年').click());
  await waitFor(() => (tableOf('支出') ? null : document.querySelector('.report-section')));
  expect(window.location.hash).toBe('#/reports');
});

test('URL のクエリの年を開く', async () => {
  window.location.hash = '#/reports?year=2024';
  renderPage('2026-09-28');
  await waitFor(() => document.querySelector('.report-section'));

  expect(document.querySelector('.report-year-label')?.textContent).toBe('2024年');
});

test('期間を指定すると、その期間の表を、年をまたぐ月の列で出し、URL のクエリに残す', async () => {
  await seedFood(['2025-11-19', '2025-11-20', '2025-12-31', '2026-01-05', '2026-01-06']);
  window.location.hash = '#/reports';
  renderPage('2026-09-28');
  await waitFor(() => tableOf('支出'));

  await act(() => field('期間を指定').click());
  expect(field('開始日').value).toBe('2026-01-01');
  expect(field('終了日').value).toBe('2026-12-31');

  await type(field('開始日'), '2025-11-20');
  await type(field('終了日'), '2026-01-05');
  await act(() => button('表示').click());
  const expense = await waitFor(() =>
    tableOf('支出')?.querySelector('caption')?.textContent?.startsWith('2025年11月')
      ? tableOf('支出')
      : null,
  );

  expect(tableRows(expense)).toEqual([
    ['カテゴリ', '2025年11月', '2025年12月', '2026年1月', '合計'],
    ['食費', '10', '100', '1,000', '1,110'],
    ['合計', '10', '100', '1,000', '1,110'],
  ]);
  expect(expense.querySelector('caption')?.textContent).toBe(
    '2025年11月20日〜2026年1月5日の支出（単位：円）',
  );
  expect(window.location.hash).toBe('#/reports?from=2025-11-20&to=2026-01-05');

  await act(() => field('1年ごと').click());
  await waitFor(() => document.querySelector('.report-year-label'));
  expect(document.querySelector('.report-year-label')?.textContent).toBe('2025年');
  expect(window.location.hash).toBe('#/reports?year=2025');
});

test('指定した期間が正しくなければ、欄に誤りを出し、表は変えない', async () => {
  window.location.hash = '#/reports?from=2026-03-01&to=2026-03-31';
  renderPage('2026-09-28');
  await waitFor(() => document.querySelector('.report-section'));

  await type(field('終了日'), '2026-02-28');
  await act(() => button('表示').click());

  const to = field('終了日');
  expect(to.getAttribute('aria-invalid')).toBe('true');
  expect(document.getElementById(to.getAttribute('aria-describedby')!)?.textContent).toBe(
    '終了日は開始日と同じ日か、それより後にしてください',
  );
  expect(document.activeElement).toBe(to);
  expect(window.location.hash).toBe('#/reports?from=2026-03-01&to=2026-03-31');
  expect([...document.querySelectorAll('.report-section p')].map((p) => p.textContent)).toEqual([
    '2026年3月1日〜2026年3月31日の支出はまだありません。',
    '2026年3月1日〜2026年3月31日の収入はまだありません。',
  ]);
});

test('URL のクエリの期間を開く', async () => {
  window.location.hash = '#/reports?from=2026-03-01&to=2026-04-15';
  renderPage('2026-09-28');
  await waitFor(() => document.querySelector('.report-section'));

  expect(field('期間を指定').checked).toBe(true);
  expect(field('開始日').value).toBe('2026-03-01');
  expect(field('終了日').value).toBe('2026-04-15');
});
