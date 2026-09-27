import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { ToastProvider } from '../../components/Toast/index.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount, deleteAccount } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { addTransaction, listTransactions } from '../../db/repositories/transactions.ts';
import { TransactionList } from './TransactionList.tsx';

const testDbName = 'kakeibo-transaction-list-test';

afterEach(async () => {
  render(null, document.body);
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '#');
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

function renderPage(today = '2026-09-28', pageSize?: number) {
  render(
    <ToastProvider>
      <TransactionList dbName={testDbName} today={today} pageSize={pageSize} />
    </ToastProvider>,
    document.body,
  );
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
    [...document.querySelectorAll('p')].find((p) => p.textContent?.includes('取引はありません')),
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

async function selectAccount(name: string) {
  const select = await waitFor(() =>
    document.querySelector<HTMLSelectElement>('#transaction-filter-account'),
  );
  const option = await waitFor(() => [...select.options].find((o) => o.textContent === name));
  await act(() => {
    select.value = option.value;
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

test('口座を選ぶと、その口座が関わる取引だけに絞り込み、振替は振替元と振替先の両方で出す', async () => {
  const { lunch, salary, withdrawal } = await setup();
  renderPage();
  await days();

  await selectAccount('現金');
  await waitFor(async () => (await rows()).length === 2);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${lunch.id}`,
    `#/transactions/${withdrawal.id}`,
  ]);

  await selectAccount('銀行');
  await waitFor(
    async () => (await rows())[0]?.getAttribute('href') === `#/transactions/${salary.id}`,
  );
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${salary.id}`,
    `#/transactions/${withdrawal.id}`,
  ]);

  await selectAccount('すべての口座');
  await waitFor(async () => (await rows()).length === 3);
});

test('絞り込んだ口座の取引がその月に無ければ、月と口座の名前を添えてその旨を出す', async () => {
  const db = await openKakeiboDB(testDbName);
  await addAccount(db, { name: 'カード', type: 'card', initialBalance: 0 });
  db.close();
  await setup();
  renderPage();
  await days();

  await selectAccount('カード');
  expect((await emptyMessage()).textContent).toContain('2026年9月のカードの取引はありません');
});

test('月を切り替えても、口座の絞り込みを保つ', async () => {
  const { bank, expense, lunch } = await setup();
  const db = await openKakeiboDB(testDbName);
  await addTransaction(db, {
    date: '2026-10-05',
    amount: 100,
    type: 'expense',
    categoryId: expense.id,
    accountId: bank.id,
    memo: '',
  });
  db.close();
  renderPage();
  await days();
  await selectAccount('現金');

  await clickButton('翌月');
  expect((await emptyMessage()).textContent).toContain('2026年10月の現金の取引はありません');

  await clickButton('前月');
  await waitFor(async () => (await rows()).length === 2);
  expect((await rows()).map((a) => a.getAttribute('href'))).toContain(`#/transactions/${lunch.id}`);
});

test('口座とカテゴリを両方選ぶと、どちらにも当てはまる取引だけを出す', async () => {
  const { expense, income, lunch } = await setup();
  renderPage();
  await days();

  await selectAccount('現金');
  await selectCategory(expense.id);
  await waitFor(async () => (await rows()).length === 1);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([`#/transactions/${lunch.id}`]);

  await selectCategory(income.id);
  expect((await emptyMessage()).textContent).toMatch(
    /^2026年9月の現金の「.+」の取引はありません。$/,
  );
});

async function searchMemo(keyword: string) {
  const input = await waitFor(() =>
    document.querySelector<HTMLInputElement>('#transaction-filter-memo'),
  );
  await act(() => {
    input.value = keyword;
    input.dispatchEvent(new Event('input'));
  });
}

test('メモにキーワードを入れると、メモにそのキーワードを含む取引だけを出す', async () => {
  const { lunch } = await setup();
  renderPage();
  await days();

  await searchMemo('ランチ');
  await waitFor(async () => (await rows()).length === 1);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([`#/transactions/${lunch.id}`]);

  await searchMemo('');
  await waitFor(async () => (await rows()).length === 3);
});

test('メモにキーワードを含む取引が無ければ、キーワードを添えてその旨を出し、入力画面へのリンクは出さない', async () => {
  await setup();
  renderPage();
  await days();

  await searchMemo(' 家賃 ');
  const message = await emptyMessage();
  expect(message.textContent).toBe('2026年9月で、メモに「家賃」を含む取引はありません。');
  expect(message.querySelector('a')).toBeNull();
});

test('メモのキーワードは、月を切り替えても残す', async () => {
  const { expense, cash } = await setup();
  const db = await openKakeiboDB(testDbName);
  const lateLunch = await addTransaction(db, {
    date: '2026-10-05',
    amount: 900,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: 'ランチ',
  });
  await addTransaction(db, {
    date: '2026-10-06',
    amount: 500,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '文房具',
  });
  db.close();
  renderPage();
  await days();

  await searchMemo('ランチ');
  await clickButton('翌月');
  await waitFor(() => monthLabel() === '2026年10月');
  await waitFor(async () => (await rows()).length === 1);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${lateLunch.id}`,
  ]);
  expect(document.querySelector<HTMLInputElement>('#transaction-filter-memo')!.value).toBe(
    'ランチ',
  );
});

async function selectSortOrder(label: string) {
  const select = await waitFor(() =>
    document.querySelector<HTMLSelectElement>('#transaction-sort'),
  );
  const option = [...select.options].find((o) => o.textContent === label)!;
  await act(() => {
    select.value = option.value;
    select.dispatchEvent(new Event('change'));
  });
}

test('並び順の選択肢は日付の新しい順・古い順、金額の大きい順・小さい順で、最初は日付の新しい順', async () => {
  await setup();
  renderPage();
  const select = await waitFor(() =>
    document.querySelector<HTMLSelectElement>('#transaction-sort'),
  );

  expect([...select.options].map((o) => o.textContent)).toEqual([
    '日付の新しい順',
    '日付の古い順',
    '金額の大きい順',
    '金額の小さい順',
  ]);
  expect(select.selectedOptions[0]!.textContent).toBe('日付の新しい順');
});

test('日付の古い順を選ぶと、日ごとのまとまりを古い順に並べる', async () => {
  await setup();
  renderPage();
  await days();

  await selectSortOrder('日付の古い順');
  await waitFor(async () => (await days())[0]!.date === '2026-09-01');
  expect((await days()).map((d) => d.date)).toEqual(['2026-09-01', '2026-09-10', '2026-09-25']);
});

test('金額の順を選ぶと、日ごとにまとめずに金額の順に並べ、取引ごとに日付を添える', async () => {
  const { lunch, salary, withdrawal } = await setup();
  renderPage();
  await days();

  await selectSortOrder('金額の大きい順');
  await waitFor(() => document.querySelector('.transaction-list-date'));
  expect(document.querySelector('.transaction-day')).toBeNull();
  const found = await rows();
  expect(found.map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${salary.id}`,
    `#/transactions/${withdrawal.id}`,
    `#/transactions/${lunch.id}`,
  ]);
  expect(text(found[2]!, 'detail')).toBe('2026-09-10 ・ 現金 ・ ランチ');

  await selectSortOrder('金額の小さい順');
  await waitFor(
    async () => (await rows())[0]!.getAttribute('href') === `#/transactions/${lunch.id}`,
  );
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${lunch.id}`,
    `#/transactions/${withdrawal.id}`,
    `#/transactions/${salary.id}`,
  ]);
});

test('並び順は、絞り込みと組み合わせても、月を切り替えても残す', async () => {
  const { expense, cash, lunch } = await setup();
  const db = await openKakeiboDB(testDbName);
  const big = await addTransaction(db, {
    date: '2026-10-05',
    amount: 5000,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: 'ランチ会',
  });
  const small = await addTransaction(db, {
    date: '2026-10-20',
    amount: 300,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: 'ランチ',
  });
  await addTransaction(db, {
    date: '2026-10-21',
    amount: 100,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '文房具',
  });
  db.close();
  renderPage();
  await days();

  await selectSortOrder('金額の大きい順');
  await searchMemo('ランチ');
  await waitFor(async () => (await rows()).length === 1);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([`#/transactions/${lunch.id}`]);

  await clickButton('翌月');
  await waitFor(() => monthLabel() === '2026年10月');
  await waitFor(async () => (await rows()).length === 2);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${big.id}`,
    `#/transactions/${small.id}`,
  ]);
  expect(document.querySelector('.transaction-day')).toBeNull();
});

async function enterAmount(name: '金額の下限' | '金額の上限', value: string) {
  const input = await waitFor(() =>
    document.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`),
  );
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  });
  return input;
}

test('金額の下限と上限を入れると、その範囲（両端を含む）の取引だけを出す', async () => {
  const { lunch, withdrawal } = await setup();
  renderPage();
  await days();

  await enterAmount('金額の下限', '800');
  await enterAmount('金額の上限', '30,000');
  await waitFor(async () => (await rows()).length === 2);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${lunch.id}`,
    `#/transactions/${withdrawal.id}`,
  ]);

  await enterAmount('金額の下限', '');
  await enterAmount('金額の上限', '');
  await waitFor(async () => (await rows()).length === 3);
});

test('金額に整数でない値を入れると、その端では絞り込まず、入力欄に印を付ける', async () => {
  await setup();
  renderPage();
  await days();

  await enterAmount('金額の上限', '1000');
  await waitFor(async () => (await rows()).length === 1);

  const input = await enterAmount('金額の上限', 'abc');
  await waitFor(async () => (await rows()).length === 3);
  expect(input.getAttribute('aria-invalid')).toBe('true');
});

test('金額の範囲に入る取引が無ければ、範囲を添えてその旨を出し、入力画面へのリンクは出さない', async () => {
  await setup();
  renderPage();
  await days();

  await enterAmount('金額の下限', '300000');
  const message = await emptyMessage();
  expect(message.textContent).toBe('2026年9月で、金額が300,000円以上の取引はありません。');
  expect(message.querySelector('a')).toBeNull();

  await searchMemo('ランチ');
  await enterAmount('金額の上限', '400000');
  await waitFor(
    async () =>
      (await emptyMessage()).textContent ===
      '2026年9月で、メモに「ランチ」を含み、金額が300,000円以上400,000円以下の取引はありません。',
  );
});

test('金額の範囲は、月を切り替えても残す', async () => {
  const { expense, cash } = await setup();
  const db = await openKakeiboDB(testDbName);
  const dinner = await addTransaction(db, {
    date: '2026-10-05',
    amount: 5000,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '',
  });
  await addTransaction(db, {
    date: '2026-10-06',
    amount: 500,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '',
  });
  db.close();
  renderPage();
  await days();

  await enterAmount('金額の下限', '1000');
  await enterAmount('金額の上限', '10000');
  await clickButton('翌月');
  await waitFor(() => monthLabel() === '2026年10月');
  await waitFor(async () => (await rows()).length === 1);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${dinner.id}`,
  ]);
});

function pagerLabel() {
  return document.querySelector('.transaction-pager-label')?.textContent;
}

function pagerButton(name: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('.transaction-pager button')].find(
    (b) => b.textContent === name,
  )!;
}

test('取引が1ページに収まれば、ページ送りを出さない', async () => {
  await setup();
  renderPage('2026-09-28', 3);
  await days();

  expect(document.querySelector('.transaction-pager')).toBeNull();
});

test('取引が pageSize 件を超えたら、ページに分けて出し、前へ・次へでページを送る', async () => {
  const { lunch, salary, withdrawal } = await setup();
  renderPage('2026-09-28', 2);

  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${salary.id}`,
    `#/transactions/${lunch.id}`,
  ]);
  expect(pagerLabel()).toBe('1 / 2ページ（3件中 1〜2件目）');
  expect(pagerButton('前へ').disabled).toBe(true);

  await act(() => pagerButton('次へ').click());
  await waitFor(() => pagerLabel() === '2 / 2ページ（3件中 3〜3件目）');
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${withdrawal.id}`,
  ]);
  expect(pagerButton('次へ').disabled).toBe(true);

  await act(() => pagerButton('前へ').click());
  await waitFor(() => pagerLabel() === '1 / 2ページ（3件中 1〜2件目）');
});

test('日がページをまたいでも、小計はその日の取引すべてで出す', async () => {
  const { cash, expense } = await setup();
  const db = await openKakeiboDB(testDbName);
  await addTransaction(db, {
    date: '2026-09-10',
    amount: 400,
    type: 'expense',
    categoryId: expense.id,
    accountId: cash.id,
    memo: '',
  });
  db.close();
  renderPage('2026-09-28', 2);
  const found = await days();

  expect(found.map((d) => ({ date: d.date, subtotal: d.subtotal, count: d.links.length }))).toEqual(
    [
      { date: '2026-09-25', subtotal: '小計+250,000円', count: 1 },
      { date: '2026-09-10', subtotal: '小計-1,200円', count: 1 },
    ],
  );
});

test('金額の順に並べても、ページに分けて出す', async () => {
  const { lunch, salary, withdrawal } = await setup();
  renderPage('2026-09-28', 2);
  await days();

  const select = document.querySelector<HTMLSelectElement>('#transaction-sort')!;
  await act(() => {
    select.value = 'amount-desc';
    select.dispatchEvent(new Event('change'));
  });
  await waitFor(
    async () => (await rows())[0]?.getAttribute('href') === `#/transactions/${salary.id}`,
  );
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([
    `#/transactions/${salary.id}`,
    `#/transactions/${withdrawal.id}`,
  ]);

  await act(() => pagerButton('次へ').click());
  await waitFor(async () => (await rows()).length === 1);
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([`#/transactions/${lunch.id}`]);
});

test('絞り込みや月を変えたら、最初のページに戻す', async () => {
  await setup();
  renderPage('2026-09-28', 2);
  await days();

  await act(() => pagerButton('次へ').click());
  await waitFor(() => pagerLabel() === '2 / 2ページ（3件中 3〜3件目）');

  await enterAmount('金額の下限', '0');
  await waitFor(() => pagerLabel() === '1 / 2ページ（3件中 1〜2件目）');

  await act(() => pagerButton('次へ').click());
  await waitFor(() => pagerLabel() === '2 / 2ページ（3件中 3〜3件目）');
  await clickButton('翌月');
  await clickButton('前月');
  await waitFor(() => pagerLabel() === '1 / 2ページ（3件中 1〜2件目）');
});

test('月と絞り込みの条件を URL のクエリに書き、何も絞り込まず今月に戻せばクエリを外す', async () => {
  const { expense } = await setup();
  window.history.replaceState(null, '', '#/transactions');
  renderPage();
  await days();

  await clickButton('翌月');
  await selectAccount('現金');
  await selectType('expense');
  await selectCategory(expense.id);
  await searchMemo('ランチ');
  await enterAmount('金額の下限', '100');
  await enterAmount('金額の上限', '1,000');
  const query = new URLSearchParams(window.location.hash.split('?')[1]);
  expect(window.location.hash.startsWith('#/transactions?')).toBe(true);
  expect(Object.fromEntries(query)).toEqual({
    month: '2026-10',
    account: expect.any(String),
    type: 'expense',
    category: expense.id,
    memo: 'ランチ',
    min: '100',
    max: '1,000',
  });

  await clickButton('前月');
  await selectAccount('すべての口座');
  await selectType('');
  await selectCategory('');
  await searchMemo('');
  await enterAmount('金額の下限', '');
  await enterAmount('金額の上限', '');
  expect(window.location.hash).toBe('#/transactions');
});

test('URL のクエリにある月と絞り込みの条件で、最初から絞り込んで出す', async () => {
  const { cash, expense, lunch } = await setup();
  const query = new URLSearchParams({
    month: '2026-09',
    account: cash.id,
    type: 'expense',
    category: expense.id,
    memo: 'ラン',
    min: '500',
    max: '1000',
  });
  window.history.replaceState(null, '', `#/transactions?${query}`);
  renderPage('2026-10-15');

  await waitFor(() => monthLabel() === '2026年9月');
  expect((await rows()).map((a) => a.getAttribute('href'))).toEqual([`#/transactions/${lunch.id}`]);
  const value = (selector: string) =>
    document.querySelector<HTMLInputElement | HTMLSelectElement>(selector)?.value;
  expect(value('#transaction-filter-account')).toBe(cash.id);
  expect(value('#transaction-filter-type')).toBe('expense');
  expect(value('#transaction-filter-category')).toBe(expense.id);
  expect(value('#transaction-filter-memo')).toBe('ラン');
  expect(value('[aria-label="金額の下限"]')).toBe('500');
  expect(value('[aria-label="金額の上限"]')).toBe('1000');
});

test('URL のクエリの月や収支区分が読めなければ、今月・すべての区分にしてクエリから外す', async () => {
  await setup();
  window.history.replaceState(null, '', '#/transactions?month=2026-13&type=transfer');
  renderPage();

  await waitFor(() => monthLabel() === '2026年9月');
  expect(await days()).toHaveLength(3);
  expect(window.location.hash).toBe('#/transactions');
});

async function storedIds() {
  const db = await openKakeiboDB(testDbName);
  const ids = (await listTransactions(db)).map((t) => t.id).sort();
  db.close();
  return ids;
}

function checkboxes() {
  return [
    ...document.querySelectorAll<HTMLInputElement>('.transaction-list input[type="checkbox"]'),
  ];
}

function selectedCount() {
  return document.querySelector('.transaction-select-count')?.textContent;
}

test('「選択」を押すと、取引をリンクでなくチェックボックスにし、「やめる」でリンクに戻す', async () => {
  await setup();
  renderPage();
  await rows();

  await clickButton('選択');
  expect(checkboxes()).toHaveLength(3);
  expect(document.querySelectorAll('.transaction-list a')).toHaveLength(0);
  expect(selectedCount()).toBe('0件を選択中');

  await clickButton('やめる');
  expect(checkboxes()).toHaveLength(0);
  expect(await rows()).toHaveLength(3);
});

test('選んだ取引を、確認ダイアログで確かめてからまとめて削除する', async () => {
  const { lunch, salary, withdrawal } = await setup();
  renderPage();
  await rows();
  await clickButton('選択');
  const deleteButton = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === '削除',
  )!;
  expect(deleteButton.disabled).toBe(true);

  // 日付の新しい順なので、給与・ランチ・振替の順に並ぶ。
  await act(() => checkboxes()[0]!.click());
  await act(() => checkboxes()[1]!.click());
  expect(selectedCount()).toBe('2件を選択中');

  await clickButton('削除');
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
    '2件の取引を削除しますか？',
  );
  await clickButton('削除する');

  await waitFor(() => document.body.textContent?.includes('2件の取引を削除しました'));
  expect(await storedIds()).toEqual([withdrawal.id]);
  const links = await waitFor(async () => {
    const found = await rows();
    return found.length === 1 ? found : null;
  });
  expect(links[0]!.getAttribute('href')).toBe(`#/transactions/${withdrawal.id}`);
  expect(checkboxes()).toHaveLength(0);

  await clickButton('元に戻す');
  await waitFor(async () => (await rows()).length === 3);
  expect(await storedIds()).toEqual([lunch.id, salary.id, withdrawal.id].sort());
});

test('確認ダイアログでキャンセルすると、何も消さずに選んだままにする', async () => {
  await setup();
  renderPage();
  await rows();
  await clickButton('選択');
  await act(() => checkboxes()[0]!.click());
  await clickButton('削除');
  await clickButton('キャンセル');

  expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  expect(await storedIds()).toHaveLength(3);
  expect(selectedCount()).toBe('1件を選択中');
});

test('「すべて選択」は一覧に出ている取引だけを選び、絞り込みで隠れた取引は消さない', async () => {
  const { lunch, salary, withdrawal } = await setup();
  renderPage();
  await rows();
  const memo = document.querySelector<HTMLInputElement>('#transaction-filter-memo')!;
  await act(() => {
    memo.value = 'ランチ';
    memo.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await waitFor(async () => (await rows()).length === 1);

  await clickButton('選択');
  await clickButton('すべて選択');
  expect(selectedCount()).toBe('1件を選択中');
  expect([...document.querySelectorAll('button')].some((b) => b.textContent === 'すべて外す')).toBe(
    true,
  );
  await clickButton('削除');
  await clickButton('削除する');

  await waitFor(() => document.body.textContent?.includes('1件の取引を削除しました'));
  expect(await storedIds()).toEqual([salary.id, withdrawal.id].sort());
  expect(await storedIds()).not.toContain(lunch.id);
});

test('取引が無い月では「選択」を出さない', async () => {
  renderPage();
  await emptyMessage();
  expect([...document.querySelectorAll('button')].some((b) => b.textContent === '選択')).toBe(
    false,
  );
});
