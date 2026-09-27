import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import { isTransferRecurring, type RecurringTransaction } from '../../domain/recurring.ts';
import { openKakeiboDB } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import { listRecurringTransactions } from '../../db/repositories/recurring.ts';
import { formatYen } from '../../lib/money.ts';
import { hashFromPath } from '../../router/index.ts';
import './recurringList.css';

type Loaded = {
  recurrings: RecurringTransaction[];
  categoryNames: ReadonlyMap<string, string>;
  accountNames: ReadonlyMap<string, string>;
};

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

// カテゴリや口座が消されていても、一覧は出す。
const missingName = '（削除済み）';

function namesById(items: readonly (Category | Account)[]): ReadonlyMap<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

/** 収入は `+`、支出は `-` を付ける。振替はお金が増えも減りもしないので、符号を付けない。 */
function signedAmount(recurring: RecurringTransaction): string {
  if (recurring.type === 'income') return `+${formatYen(recurring.amount)}`;
  if (recurring.type === 'expense') return formatYen(-recurring.amount);
  return formatYen(recurring.amount);
}

/**
 * 定期取引の一覧画面。すべての定期取引を、毎月の日の早い順に出す。
 * 定期取引を押すと編集画面を開き、そこで直すか停止する。
 */
export function RecurringList({ dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [recurrings, categories, accounts] = await Promise.all([
        listRecurringTransactions(db),
        listCategories(db),
        listAccounts(db),
      ]);
      if (cancelled) return;
      setLoaded({
        recurrings,
        categoryNames: namesById(categories),
        accountNames: namesById(accounts),
      });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [dbName]);

  function row(recurring: RecurringTransaction, { categoryNames, accountNames }: Loaded) {
    const accountName = (id: string) => accountNames.get(id) ?? missingName;
    const title = isTransferRecurring(recurring)
      ? '振替'
      : (categoryNames.get(recurring.categoryId) ?? missingName);
    const account = isTransferRecurring(recurring)
      ? `${accountName(recurring.accountId)} → ${accountName(recurring.toAccountId)}`
      : accountName(recurring.accountId);
    return (
      <li key={recurring.id}>
        <a class="recurring-list-item" href={hashFromPath(`/recurring/${recurring.id}`)}>
          <span class="recurring-list-day">毎月{recurring.dayOfMonth}日</span>
          <span class="recurring-list-title">{title}</span>
          <span class={`recurring-list-amount recurring-list-amount-${recurring.type}`}>
            {signedAmount(recurring)}
          </span>
          <span class="recurring-list-detail">
            {account}
            {recurring.memo !== '' && ` ・ ${recurring.memo}`}
          </span>
        </a>
      </li>
    );
  }

  function body() {
    if (!loaded) return <p>読み込み中…</p>;
    if (loaded.recurrings.length === 0) return <p>定期取引はまだありません。</p>;
    return <ul class="recurring-list">{loaded.recurrings.map((r) => row(r, loaded))}</ul>;
  }

  return (
    <>
      <h2>定期取引</h2>
      <p>
        <a href={hashFromPath('/recurring/new')}>定期取引を追加する</a>
      </p>
      {body()}
    </>
  );
}
