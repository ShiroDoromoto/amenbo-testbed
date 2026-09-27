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

function renderPage(today = '2026-09-28') {
  render(<TransactionList dbName={testDbName} today={today} />, document.body);
}

function monthLabel() {
  return document.querySelector('.transaction-month-label')?.textContent;
}

async function clickButton(name: string) {
  const button = [...document.querySelectorAll('button')].find((b) => b.textContent === name)!;
  await act(() => button.click());
}

async function emptyMessage() {
  return waitFor(() =>
    [...document.querySelectorAll('p')].find((p) => p.textContent?.includes('の取引はありません')),
  );
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

async function days() {
  const list = await waitFor(() => document.querySelector('.transaction-list'));
  return [...list.querySelectorAll<HTMLElement>('.transaction-day')].map((day) => ({
    date: day.querySelector('.transaction-day-date')?.textContent,
    subtotal: day.querySelector('.transaction-day-subtotal')?.textContent,
    links: [...day.querySelectorAll('a')].map((a) => a.getAttribute('href')),
  }));
}

test('取引を日付の新しい順に日ごとにまとめ、それぞれ編集画面へのリンクにする', async () => {
  const { lunch, salary, withdrawal } = await setup();
  renderPage();

  expect((await days()).map(({ date, links }) => ({ date, links }))).toEqual([
    { date: '2026-09-25', links: [`#/transactions/${salary.id}`] },
    { date: '2026-09-10', links: [`#/transactions/${lunch.id}`] },
    { date: '2026-09-01', links: [`#/transactions/${withdrawal.id}`] },
  ]);
});

test('同じ日の取引は1つにまとめ、日ごとに収入から支出を引いた小計を出す', async () => {
  const { cash, bank, expense, lunch } = await setup();
  const db = await openKakeiboDB(testDbName);
  const coffee = await addTransaction(db, {
    date: '2026-09-10',
    amount: 400,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '',
  });
  await addTransaction(db, {
    date: '2026-09-10',
    amount: 10000,
    type: 'transfer',
    accountId: bank.id,
    toAccountId: cash.id,
    memo: '',
  });
  db.close();
  renderPage();
  const found = await days();

  expect(found.map((d) => d.subtotal)).toEqual(['小計+250,000円', '小計-1,200円', '小計0円']);
  expect(found[1]!.links).toHaveLength(3);
  expect(found[1]!.links).toEqual(
    expect.arrayContaining([`#/transactions/${lunch.id}`, `#/transactions/${coffee.id}`]),
  );
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

test('その月に取引が無ければ、その旨と入力画面へのリンクを出す', async () => {
  renderPage();
  const message = await emptyMessage();

  expect(message.textContent).toContain('2026年9月の取引はありません');
  expect(message.querySelector('a')?.getAttribute('href')).toBe('#/transactions/new');
  expect(document.querySelector('.transaction-list')).toBeNull();
});

test('最初は今日の月の取引だけを出す', async () => {
  const { cash, expense, lunch } = await setup();
  const db = await openKakeiboDB(testDbName);
  for (const date of ['2026-08-31', '2026-10-01']) {
    await addTransaction(db, {
      date,
      amount: 100,
      type: 'expense',
      categoryId: expense.id,
      accountId: cash.id,
      memo: '',
    });
  }
  db.close();
  renderPage('2026-09-15');

  expect(monthLabel()).toBe('2026年9月');
  expect((await days()).map((d) => d.date)).toEqual(['2026-09-25', '2026-09-10', '2026-09-01']);
  expect((await rows()).map((a) => a.getAttribute('href'))).toContain(`#/transactions/${lunch.id}`);
});

test('前月・翌月のボタンで、表示する月を切り替える', async () => {
  const { cash, expense } = await setup();
  const db = await openKakeiboDB(testDbName);
  const august = await addTransaction(db, {
    date: '2026-08-31',
    amount: 100,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '',
  });
  db.close();
  renderPage();
  await days();

  await clickButton('前月');
  expect(monthLabel()).toBe('2026年8月');
  await waitFor(async () => (await days()).length === 1);
  expect((await days())[0]!.links).toEqual([`#/transactions/${august.id}`]);

  await clickButton('翌月');
  await clickButton('翌月');
  expect(monthLabel()).toBe('2026年10月');
  expect((await emptyMessage()).textContent).toContain('2026年10月の取引はありません');

  await clickButton('前月');
  expect(monthLabel()).toBe('2026年9月');
  expect(await days()).toHaveLength(3);
});

test('年をまたいで月を切り替える', async () => {
  renderPage('2026-01-31');
  await emptyMessage();

  await clickButton('前月');
  expect(monthLabel()).toBe('2025年12月');
  await clickButton('翌月');
  await clickButton('翌月');
  expect(monthLabel()).toBe('2026年2月');
});

async function selectCategory(value: string) {
  const select = await waitFor(() =>
    document.querySelector<HTMLSelectElement>('#transaction-filter-category'),
  );
  select.value = value;
  await act(() => {
    select.dispatchEvent(new Event('change'));
  });
}

test('カテゴリの選択肢は、支出と収入に分けて並び順に出す', async () => {
  const db = await openKakeiboDB(testDbName);
  const categories = await listCategories(db);
  db.close();
  renderPage();
  const select = await waitFor(() =>
    document.querySelector<HTMLSelectElement>('#transaction-filter-category'),
  );

  expect(select.value).toBe('');
  expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['支出', '収入']);
  const [expenses, incomes] = [...select.querySelectorAll('optgroup')].map((g) =>
    [...g.querySelectorAll('option')].map((o) => o.value),
  );
  expect(expenses).toEqual(categories.filter((c) => c.type === 'expense').map((c) => c.id));
  expect(incomes).toEqual(categories.filter((c) => c.type === 'income').map((c) => c.id));
});

test('カテゴリを選ぶと、そのカテゴリの取引だけを出し、振替は出さない', async () => {
  const { expense, lunch } = await setup();
  renderPage();
  await days();

  await selectCategory(expense.id);
  await waitFor(async () => (await days()).length === 1);
  expect(await days()).toEqual([
    { date: '2026-09-10', subtotal: '小計-800円', links: [`#/transactions/${lunch.id}`] },
  ]);

  await selectCategory('');
  expect(await days()).toHaveLength(3);
});

test('選んだカテゴリの取引が無ければ、その旨を出す', async () => {
  const { expense } = await setup();
  const db = await openKakeiboDB(testDbName);
  const other = (await listCategories(db, 'expense')).find((c) => c.id !== expense.id)!;
  db.close();
  renderPage();
  await days();

  await selectCategory(other.id);
  const message = await emptyMessage();
  expect(message.textContent).toBe(`2026年9月の「${other.name}」の取引はありません。`);
  expect(document.querySelector('.transaction-list')).toBeNull();
});

test('選んだカテゴリは、月を切り替えても残す', async () => {
  const { cash, expense, income } = await setup();
  const db = await openKakeiboDB(testDbName);
  const august = await addTransaction(db, {
    date: '2026-08-31',
    amount: 100,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '',
  });
  await addTransaction(db, {
    date: '2026-08-25',
    amount: 1000,
    type: 'income',
    categoryId: income.id,
    accountId: cash.id,
    memo: '',
  });
  db.close();
  renderPage();
  await days();

  await selectCategory(expense.id);
  await clickButton('前月');
  await waitFor(async () => monthLabel() === '2026年8月' && (await days()).length === 1);
  expect((await days())[0]!.links).toEqual([`#/transactions/${august.id}`]);
  expect(document.querySelector<HTMLSelectElement>('#transaction-filter-category')!.value).toBe(
    expense.id,
  );
});

async function selectType(value: string) {
  const select = await waitFor(() =>
    document.querySelector<HTMLSelectElement>('#transaction-filter-type'),
  );
  select.value = value;
  await act(() => {
    select.dispatchEvent(new Event('change'));
  });
}

function categoryGroupLabels() {
  return [...document.querySelectorAll('#transaction-filter-category optgroup')].map(
    (g) => (g as HTMLOptGroupElement).label,
  );
}

test('収支区分を選ぶと、その区分の取引だけを出し、振替は出さない', async () => {
  const { lunch, salary } = await setup();
  renderPage();
  await days();

  await selectType('income');
  await waitFor(async () => (await days()).length === 1);
  expect((await days())[0]!.links).toEqual([`#/transactions/${salary.id}`]);

  await selectType('expense');
  await waitFor(async () => (await days())[0]!.links[0] === `#/transactions/${lunch.id}`);
  expect(await days()).toHaveLength(1);

  await selectType('');
  expect(await days()).toHaveLength(3);
});

test('収支区分を選ぶと、カテゴリの選択肢をその区分のものだけにする', async () => {
  await setup();
  renderPage();
  await days();
  expect(categoryGroupLabels()).toEqual(['支出', '収入']);

  await selectType('income');
  expect(categoryGroupLabels()).toEqual(['収入']);

  await selectType('');
  expect(categoryGroupLabels()).toEqual(['支出', '収入']);
});

test('選んでいたカテゴリと別の収支区分を選ぶと、カテゴリを「すべて」に戻す', async () => {
  const { expense, income, salary } = await setup();
  renderPage();
  await days();
  const category = () =>
    document.querySelector<HTMLSelectElement>('#transaction-filter-category')!.value;

  await selectCategory(income.id);
  await selectType('income');
  expect(category()).toBe(income.id);

  await selectType('');
  await selectCategory(expense.id);
  await selectType('income');
  expect(category()).toBe('');
  expect((await days()).map((d) => d.links)).toEqual([[`#/transactions/${salary.id}`]]);
});

test('選んだ収支区分の取引が無ければ、その旨を出す', async () => {
  const db = await openKakeiboDB(testDbName);
  const cash = await addAccount(db, { name: '現金', type: 'cash', initialBalance: 0 });
  const expense = (await listCategories(db, 'expense'))[0]!;
  await addTransaction(db, {
    date: '2026-09-10',
    amount: 800,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '',
  });
  db.close();
  renderPage();
  await days();

  await selectType('income');
  const message = await emptyMessage();
  expect(message.textContent).toBe('2026年9月の「収入」の取引はありません。');
  expect(document.querySelector('.transaction-list')).toBeNull();
});

test('選んだ収支区分は、月を切り替えても残す', async () => {
  const { cash, expense, income } = await setup();
  const db = await openKakeiboDB(testDbName);
  await addTransaction(db, {
    date: '2026-08-31',
    amount: 100,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '',
  });
  const august = await addTransaction(db, {
    date: '2026-08-25',
    amount: 1000,
    type: 'income',
    categoryId: income.id,
    accountId: cash.id,
    memo: '',
  });
  db.close();
  renderPage();
  await days();

  await selectType('income');
  await clickButton('前月');
  await waitFor(async () => monthLabel() === '2026年8月' && (await days()).length === 1);
  expect((await days())[0]!.links).toEqual([`#/transactions/${august.id}`]);
  expect(document.querySelector<HTMLSelectElement>('#transaction-filter-type')!.value).toBe(
    'income',
  );
});
