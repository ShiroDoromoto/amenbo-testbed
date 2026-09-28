import type { KakeiboDB } from '../index.ts';
import type { Migration } from './run.ts';

/**
 * 予算のストアを作る。カテゴリと月の組で1件だけ引ける一意の索引と、月で引く索引を付ける。
 */
export const v6: Migration<KakeiboDB> = {
  version: 6,
  migrate(db) {
    const budgets = db.createObjectStore('budgets', { keyPath: 'id' });
    budgets.createIndex('by-category-month', ['categoryId', 'month'], { unique: true });
    budgets.createIndex('by-month', 'month');
  },
};
