import { openKakeiboDB } from '../db/index.ts';
import { generateDueTransactions } from '../db/repositories/recurring.ts';
import type { Transaction } from '../domain/transaction.ts';
import { toDateString } from '../lib/date.ts';

/** 起動時に一度だけ行う処理。定期取引から、今日までに起こすべき取引を作り、作った取引を返す。 */
export async function runStartupTasks(
  dbName?: string,
  now: Date = new Date(),
): Promise<Transaction[]> {
  const db = await openKakeiboDB(dbName);
  try {
    return await generateDueTransactions(db, toDateString(now));
  } finally {
    db.close();
  }
}
