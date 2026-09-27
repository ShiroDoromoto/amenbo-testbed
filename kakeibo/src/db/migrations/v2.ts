import type { KakeiboDB } from '../index.ts';
import { seedDefaultCategories } from '../seed.ts';
import type { Migration } from './run.ts';

/** カテゴリがまだ無ければ、既定のカテゴリを登録する。 */
export const v2: Migration<KakeiboDB> = {
  version: 2,
  async migrate(_db, tx) {
    await seedDefaultCategories(tx.objectStore('categories'));
  },
};
