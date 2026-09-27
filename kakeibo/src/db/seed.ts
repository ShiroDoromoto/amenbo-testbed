import type { IDBPObjectStore, StoreNames } from 'idb';
import type { Category } from '../domain/category.ts';
import type { KakeiboDB } from './index.ts';

export type DefaultCategory = Omit<Category, 'id'>;

/** 初回起動時に登録するカテゴリ。`order` は収支区分ごとに 0 から振る。 */
export const defaultCategories: readonly DefaultCategory[] = [
  { name: '食費', type: 'expense', color: '#e8590c', order: 0 },
  { name: '日用品', type: 'expense', color: '#f59f00', order: 1 },
  { name: '交通費', type: 'expense', color: '#1c7ed6', order: 2 },
  { name: '住居費', type: 'expense', color: '#5f3dc4', order: 3 },
  { name: '水道光熱費', type: 'expense', color: '#0ca678', order: 4 },
  { name: '通信費', type: 'expense', color: '#1098ad', order: 5 },
  { name: '医療費', type: 'expense', color: '#e03131', order: 6 },
  { name: '趣味・娯楽', type: 'expense', color: '#d6336c', order: 7 },
  { name: '衣服・美容', type: 'expense', color: '#ae3ec9', order: 8 },
  { name: 'その他', type: 'expense', color: '#868e96', order: 9 },
  { name: '給与', type: 'income', color: '#2f9e44', order: 0 },
  { name: '賞与', type: 'income', color: '#66a80f', order: 1 },
  { name: '臨時収入', type: 'income', color: '#74b816', order: 2 },
  { name: 'その他', type: 'income', color: '#868e96', order: 3 },
];

type CategoriesStore = IDBPObjectStore<
  KakeiboDB,
  StoreNames<KakeiboDB>[],
  'categories',
  'versionchange'
>;

/**
 * カテゴリが1件も無ければ、既定のカテゴリに id を振って登録する。1件でもあれば何もしない。
 * 移行の中から呼ぶ。移行は DB ごとに一度しか当たらないので、利用者が全部消しても登録し直さない。
 */
export async function seedDefaultCategories(store: CategoriesStore): Promise<void> {
  if ((await store.count()) > 0) return;
  for (const category of defaultCategories) {
    await store.add({ ...category, id: crypto.randomUUID() });
  }
}
