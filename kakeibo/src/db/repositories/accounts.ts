import type { KakeiboDBConnection } from '../index.ts';
import type { Account } from '../../domain/account.ts';

/** 追加する口座。締め日と引き落とし日は省けて、省くと `null`（決めていない）になる。 */
export type NewAccount = Omit<Account, 'id' | 'closingDay' | 'paymentDay'> &
  Partial<Pick<Account, 'closingDay' | 'paymentDay'>>;

/** 口座を追加し、id を振って返す。 */
export async function addAccount(db: KakeiboDBConnection, input: NewAccount): Promise<Account> {
  const account: Account = {
    closingDay: null,
    paymentDay: null,
    ...input,
    id: crypto.randomUUID(),
  };
  await db.add('accounts', account);
  return account;
}

/** 既存の口座を丸ごと置き換える。id の口座が無ければ投げる。 */
export async function updateAccount(db: KakeiboDBConnection, account: Account): Promise<void> {
  const tx = db.transaction('accounts', 'readwrite');
  if ((await tx.store.getKey(account.id)) === undefined) {
    tx.abort();
    await tx.done.catch(() => {});
    throw new Error(`Account not found: ${account.id}`);
  }
  await tx.store.put(account);
  await tx.done;
}

/** 口座を消す。id の口座が無ければ何もしない。取引から参照されていても消す。 */
export async function deleteAccount(db: KakeiboDBConnection, id: string): Promise<void> {
  await db.delete('accounts', id);
}

/** id の口座を返す。無ければ `undefined`。 */
export async function getAccount(
  db: KakeiboDBConnection,
  id: string,
): Promise<Account | undefined> {
  return db.get('accounts', id);
}

/** 口座を名前順で返す。 */
export async function listAccounts(db: KakeiboDBConnection): Promise<Account[]> {
  const accounts = await db.getAll('accounts');
  return accounts.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}
