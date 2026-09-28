import type { KakeiboDB } from '../index.ts';
import type { Migration } from './run.ts';
import { v1 } from './v1.ts';
import { v2 } from './v2.ts';
import { v3 } from './v3.ts';
import { v4 } from './v4.ts';
import { v5 } from './v5.ts';
import { v6 } from './v6.ts';

export { applyMigrations, latestVersion, type Migration } from './run.ts';

/**
 * kakeibo の移行。古い順に並べる。
 * スキーマを変えるときは `vN.ts` を足してここの末尾に加える。当て済みの移行は書き換えない。
 */
export const migrations: readonly Migration<KakeiboDB>[] = [v1, v2, v3, v4, v5, v6];
