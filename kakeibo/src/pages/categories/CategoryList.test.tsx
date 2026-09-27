import 'fake-indexeddb/auto';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, test } from 'vitest';
import { deleteDB } from 'idb';
import { ToastProvider } from '../../components/Toast/index.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { deleteCategory, listCategories } from '../../db/repositories/categories.ts';
import { defaultCategories } from '../../db/seed.ts';
import { CategoryList, newCategoryColor } from './CategoryList.tsx';

const testDbName = 'kakeibo-category-list-test';

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
  render(
    <ToastProvider>
      <CategoryList dbName={testDbName} />
    </ToastProvider>,
    document.body,
  );
}

/** 見出しが `heading` の節に並ぶ、カテゴリの名前。 */
function namesIn(heading: string): string[] {
  const section = [...document.querySelectorAll('section')].find(
    (s) => s.querySelector('h3')?.textContent === heading,
  );
  return [...(section?.querySelectorAll('.category-list-name') ?? [])].map((n) => n.textContent!);
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(() => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function submit(form: HTMLFormElement) {
  await act(() => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

const button = (label: string) =>
  [...document.querySelectorAll('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label,
  );

const errorText = () => document.querySelector('.category-error')?.textContent;

test('カテゴリを収支区分ごとに、並び順で出す', async () => {
  renderPage();
  await waitFor(() => document.querySelector('.category-list'));
  const names = (type: string) =>
    defaultCategories.filter((c) => c.type === type).map((c) => c.name);
  expect(namesIn('支出')).toEqual(names('expense'));
  expect(namesIn('収入')).toEqual(names('income'));
});

test('入力した名前で、選んだ収支区分の末尾にカテゴリを足す', async () => {
  renderPage();
  const form = await waitFor(() => document.querySelector<HTMLFormElement>('.category-add-form'));
  const name = form.querySelector<HTMLInputElement>('[name="name"]')!;
  const income = form.querySelector<HTMLInputElement>('[value="income"]')!;
  await act(() => {
    income.checked = true;
    income.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await typeInto(name, ' 副業 ');
  await submit(form);

  await waitFor(() => namesIn('収入').includes('副業'));
  expect(namesIn('収入').at(-1)).toBe('副業');
  expect(name.value).toBe('');

  const db = await openKakeiboDB(testDbName);
  const added = (await listCategories(db, 'income')).at(-1);
  db.close();
  expect(added).toMatchObject({ name: '副業', type: 'income', color: newCategoryColor, order: 4 });
});

test('名前が空か、同じ収支区分に同じ名前があれば、足さずにエラーを出す', async () => {
  renderPage();
  const form = await waitFor(() => document.querySelector<HTMLFormElement>('.category-add-form'));
  const name = form.querySelector<HTMLInputElement>('[name="name"]')!;

  await submit(form);
  expect(errorText()).toBe('名前を入力してください');
  expect(name.getAttribute('aria-invalid')).toBe('true');

  await typeInto(name, '食費');
  await submit(form);
  expect(errorText()).toBe('同じ名前のカテゴリがあります');
  expect(namesIn('支出').filter((n) => n === '食費')).toHaveLength(1);
});

test('カテゴリの名前を、その場で変える', async () => {
  renderPage();
  await waitFor(() => document.querySelector('.category-list'));
  await act(() => button('食費の名前を変える')!.click());

  const input = document.querySelector<HTMLInputElement>('[aria-label="食費の新しい名前"]')!;
  expect(input.value).toBe('食費');
  expect(document.activeElement).toBe(input);

  await typeInto(input, '日用品');
  await submit(input.form!);
  expect(errorText()).toBe('同じ名前のカテゴリがあります');

  await typeInto(input, '食料品');
  await submit(input.form!);
  await waitFor(() => namesIn('支出').includes('食料品'));
  expect(namesIn('支出')[0]).toBe('食料品');
  expect(document.querySelector('[aria-label="食費の新しい名前"]')).toBeNull();

  const db = await openKakeiboDB(testDbName);
  const names = (await listCategories(db, 'expense')).map((c) => c.name);
  db.close();
  expect(names).toContain('食料品');
  expect(names).not.toContain('食費');
});

test('名前の変更をキャンセルすると、元の名前のまま戻る', async () => {
  renderPage();
  await waitFor(() => document.querySelector('.category-list'));
  await act(() => button('給与の名前を変える')!.click());
  await typeInto(document.querySelector<HTMLInputElement>('[aria-label="給与の新しい名前"]')!, 'x');
  await act(() => button('キャンセル')!.click());

  expect(document.querySelector('[aria-label="給与の新しい名前"]')).toBeNull();
  expect(namesIn('収入')[0]).toBe('給与');
});

test('収支区分にカテゴリが無ければ、無い旨を出す', async () => {
  const db = await openKakeiboDB(testDbName);
  for (const c of await listCategories(db, 'income')) await deleteCategory(db, c.id);
  db.close();

  renderPage();
  await waitFor(() =>
    [...document.querySelectorAll('p')].find(
      (p) => p.textContent === '収入のカテゴリはまだありません。',
    ),
  );
});
