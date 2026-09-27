import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { openKakeiboDB } from '../../db/index.ts';
import { addAccount } from '../../db/repositories/accounts.ts';
import { AccountList } from './AccountList.tsx';

const testDbName = 'kakeibo-account-list-test';

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
  render(<AccountList dbName={testDbName} />, document.body);
}

const text = (row: Element, name: string) =>
  row.querySelector(`.account-list-${name}`)?.textContent;

test('口座を名前順に、種類と初期残高を添えて出し、押すと編集画面を開く', async () => {
  const db = await openKakeiboDB(testDbName);
  const card = await addAccount(db, { name: 'カード', type: 'card', initialBalance: -35000 });
  const cash = await addAccount(db, { name: '財布', type: 'cash', initialBalance: 12000 });
  db.close();

  renderPage();
  const list = await waitFor(() => document.querySelector('.account-list'));
  const rows = [...list.querySelectorAll('.account-list-item')];
  expect(rows.map((row) => text(row, 'name'))).toEqual(['カード', '財布']);
  expect(rows.map((row) => text(row, 'type'))).toEqual(['クレジットカード', '現金']);
  expect(rows.map((row) => text(row, 'balance'))).toEqual([
    '初期残高 -35,000円',
    '初期残高 12,000円',
  ]);
  expect(rows.map((row) => row.getAttribute('href'))).toEqual([
    `#/accounts/${card.id}`,
    `#/accounts/${cash.id}`,
  ]);
});

test('口座が無ければ、無い旨と追加への案内を出す', async () => {
  renderPage();
  await waitFor(() =>
    [...document.querySelectorAll('p')].find((p) => p.textContent === '口座はまだありません。'),
  );
  const add = [...document.querySelectorAll('a')].find((a) => a.textContent === '口座を追加する');
  expect(add?.getAttribute('href')).toBe('#/accounts/new');
});
