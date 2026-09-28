import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listTransactions } from '../../db/repositories/transactions.ts';
import {
  calculateBalances,
  calculateBalanceTrend,
  type BalanceTrendPoint,
} from '../../domain/balance.ts';
import { toDateString, type DateString } from '../../lib/date.ts';
import { formatYen, type Yen } from '../../lib/money.ts';
import { hashFromPath } from '../../router/index.ts';
import { accountTypeLabels } from './accountTypeLabels.ts';
import { BalanceTrendChart } from './BalanceTrendChart.tsx';
import './accountList.css';

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
  /** 今日の日付。テストで日付を決めるときに渡す。 */
  today?: DateString;
};

type AccountWithBalance = { account: Account; balance: Yen };

type Loaded = { accounts: AccountWithBalance[]; trend: BalanceTrendPoint[] };

/**
 * 口座の一覧画面。すべての口座を名前順に、種類と現在の残高を添えて出す。
 * 現在の残高は、初期残高に、保存されているすべての取引を足し引きしたもの。
 * 口座を押すと編集画面を開く。
 * 口座があれば、その下に、今月までの 12 か月の月末の残高の合計を折れ線グラフで出す。
 */
export function AccountList({ dbName, today: todayProp }: Props) {
  const [today] = useState(() => todayProp ?? toDateString(new Date()));
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [accounts, transactions] = await Promise.all([listAccounts(db), listTransactions(db)]);
      const balances = calculateBalances(accounts, transactions);
      const withBalances = accounts.map((account) => ({
        account,
        balance: balances.get(account.id) ?? account.initialBalance,
      }));
      const trend = calculateBalanceTrend(accounts, transactions, today);
      if (!cancelled) setLoaded({ accounts: withBalances, trend });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [dbName, today]);

  function body() {
    if (!loaded) return <p>読み込み中…</p>;
    if (loaded.accounts.length === 0) return <p>口座はまだありません。</p>;
    return (
      <>
        <ul class="account-list">
          {loaded.accounts.map(({ account, balance }) => (
            <li key={account.id}>
              <a class="account-list-item" href={hashFromPath(`/accounts/${account.id}`)}>
                <span class="account-list-name">{account.name}</span>
                <span class="account-list-type">{accountTypeLabels[account.type]}</span>
                <span class="account-list-balance">残高 {formatYen(balance)}</span>
              </a>
            </li>
          ))}
        </ul>
        <section class="account-balance-trend" aria-labelledby="account-balance-trend-heading">
          <h3 id="account-balance-trend-heading">残高の推移</h3>
          <BalanceTrendChart trend={loaded.trend} />
        </section>
      </>
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
