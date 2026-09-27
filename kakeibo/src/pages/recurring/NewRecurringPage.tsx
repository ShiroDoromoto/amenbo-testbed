import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import { useToast } from '../../components/Toast/index.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import {
  addRecurringTransaction,
  type NewRecurringTransaction,
} from '../../db/repositories/recurring.ts';
import { navigate } from '../../router/index.ts';
import { RecurringForm } from './RecurringForm.tsx';

type Loaded = {
  db: KakeiboDBConnection;
  categories: Category[];
  accounts: Account[];
};

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

/** 定期取引の追加画面。入力された定期取引を DB に足し、定期取引の一覧に戻る。 */
export function NewRecurringPage({ dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const toast = useToast();

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [categories, accounts] = await Promise.all([listCategories(db), listAccounts(db)]);
      if (!cancelled) setLoaded({ db, categories, accounts });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [dbName]);

  async function save(recurring: NewRecurringTransaction) {
    if (!loaded) return;
    await addRecurringTransaction(loaded.db, recurring);
    toast.show('保存しました', { kind: 'success' });
    navigate('/recurring');
  }

  return (
    <>
      <h2>定期取引の追加</h2>
      {loaded ? (
        <RecurringForm
          categories={loaded.categories}
          accounts={loaded.accounts}
          defaults={{ dayOfMonth: new Date().getDate() }}
          onSubmit={save}
        />
      ) : (
        <p>読み込み中…</p>
      )}
    </>
  );
}
