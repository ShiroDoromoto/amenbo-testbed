import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listTransactions } from '../../db/repositories/transactions.ts';
import { calculateBalances } from '../../domain/balance.ts';
import { formatYen, type Yen } from '../../lib/money.ts';
import { hashFromPath } from '../../router/index.ts';
import { accountTypeLabels } from './accountTypeLabels.ts';
import './accountList.css';

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

type AccountWithBalance = { account: Account; balance: Yen };

/**
 * 口座の一覧画面。すべての口座を名前順に、種類と現在の残高を添えて出す。
 * 現在の残高は、初期残高に、保存されているすべての取引を足し引きしたもの。
 * 口座を押すと編集画面を開く。
 */
export function AccountList({ dbName }: Props) {
  const [accounts, setAccounts] = useState<AccountWithBalance[] | null>(null);

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [loaded, transactions] = await Promise.all([listAccounts(db), listTransactions(db)]);
      const balances = calculateBalances(loaded, transactions);
      const withBalances = loaded.map((account) => ({
        account,
        balance: balances.get(account.id) ?? account.initialBalance,
      }));
      if (!cancelled) setAccounts(withBalances);
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [dbName]);

  function body() {
    if (!accounts) return <p>読み込み中…</p>;
    if (accounts.length === 0) return <p>口座はまだありません。</p>;
    return (
      <ul class="account-list">
        {accounts.map(({ account, balance }) => (
          <li key={account.id}>
            <a class="account-list-item" href={hashFromPath(`/accounts/${account.id}`)}>
              <span class="account-list-name">{account.name}</span>
              <span class="account-list-type">{accountTypeLabels[account.type]}</span>
              <span class="account-list-balance">残高 {formatYen(balance)}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <h2>口座</h2>
      <p>
        <a href={hashFromPath('/accounts/new')}>口座を追加する</a>
      </p>
      {body()}
    </>
  );
}
