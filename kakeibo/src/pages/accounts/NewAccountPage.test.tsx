import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { ToastProvider } from '../../components/Toast/index.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { NewAccountPage } from './NewAccountPage.tsx';

const testDbName = 'kakeibo-new-account-page-test';

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

function renderPage() {
  render(
    <ToastProvider>
      <NewAccountPage dbName={testDbName} />
    </ToastProvider>,
    document.body,
  );
}

test('入力した口座を足し、口座の一覧に戻る', async () => {
  renderPage();
  const form = await waitFor(() => document.querySelector('form'));
  const field = <T extends HTMLElement>(name: string) => form.querySelector<T>(`[name="${name}"]`)!;
  expect(document.querySelector('h2')?.textContent).toBe('口座の追加');
  expect(form.querySelector<HTMLInputElement>('[name="type"]:checked')?.value).toBe('cash');
  expect(field<HTMLInputElement>('initialBalance').value).toBe('0');

  await act(() => {
    form.querySelector<HTMLInputElement>('[name="type"][value="card"]')!.click();
  });
  await act(() => {
    const name = field<HTMLInputElement>('name');
    name.value = ' 楽天カード ';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const balance = field<HTMLInputElement>('initialBalance');
    balance.value = '-35,000';
    balance.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  await waitFor(() => window.location.hash === '#/accounts');
  const check = await openKakeiboDB(testDbName);
  const saved = await listAccounts(check);
  check.close();
  expect(saved).toEqual([
    {
      id: saved[0]!.id,
      name: '楽天カード',
      type: 'card',
      initialBalance: -35000,
      closingDay: null,
      paymentDay: null,
    },
  ]);
  expect(document.body.textContent).toContain('保存しました');
});

test('入力に誤りがあれば、足さずにエラーを出す', async () => {
  renderPage();
  const form = await waitFor(() => document.querySelector('form'));
  await act(() => {
    const balance = form.querySelector<HTMLInputElement>('[name="initialBalance"]')!;
    balance.value = '1.5';
    balance.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  const errors = [...form.querySelectorAll('.transaction-form-error')].map((p) => p.textContent);
  expect(errors).toEqual(['名前を入れてください', '初期残高は整数で入れてください']);
  expect(document.activeElement?.getAttribute('name')).toBe('name');
  expect(window.location.hash).toBe('');

  const check = await openKakeiboDB(testDbName);
  expect(await listAccounts(check)).toEqual([]);
  check.close();
});
