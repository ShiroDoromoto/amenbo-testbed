import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import type { Category } from '../../domain/category.ts';
import type { RecurringTransaction } from '../../domain/recurring.ts';
import { ConfirmDialog } from '../../components/ConfirmDialog/index.ts';
import { useToast } from '../../components/Toast/index.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import { listAccounts } from '../../db/repositories/accounts.ts';
import { listCategories } from '../../db/repositories/categories.ts';
import {
  deleteRecurringTransaction,
  getRecurringTransaction,
  updateRecurringTransaction,
  type NewRecurringTransaction,
} from '../../db/repositories/recurring.ts';
import { navigate } from '../../router/index.ts';
import { RecurringForm } from './RecurringForm.tsx';
// 停止ボタンの見た目は、取引の削除ボタンに揃える。
import '../transactions/editTransactionPage.css';

type Loaded = {
  db: KakeiboDBConnection;
  categories: Category[];
  accounts: Account[];
  recurring: RecurringTransaction | undefined;
};

type Props = {
  /** 編集する定期取引の id。 */
  id: string;
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

/**
 * `current` を、フォームで直した `edited` で置き換えた定期取引を返す。
 * 区分で持つ欄が変わるので、カテゴリと振替先は `edited` のものだけを使う。
 * フォームで扱わない欄（取引を起こした記録など）は、`current` のまま残す。
 */
export function replaceRecurring(
  current: RecurringTransaction,
  edited: NewRecurringTransaction,
): RecurringTransaction {
  const kept: Partial<Record<string, unknown>> = { ...current };
  delete kept.categoryId;
  delete kept.toAccountId;
  return { ...kept, ...edited, id: current.id } as RecurringTransaction;
}

/**
 * 定期取引の編集画面。id の定期取引を DB から読んでフォームに入れ、保存したら定期取引の一覧に戻る。
 * 確認ダイアログで確かめてから、定期取引を停止することもできる。停止すると定期取引を消し、これから先の取引を起こさない。
 * 既に起こした取引は残る。
 */
export function EditRecurringPage({ id, dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [stopping, setStopping] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const [categories, accounts, recurring] = await Promise.all([
        listCategories(db),
        listAccounts(db),
        getRecurringTransaction(db, id),
      ]);
      if (!cancelled) setLoaded({ db, categories, accounts, recurring });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [id, dbName]);

  async function save(edited: NewRecurringTransaction) {
    if (!loaded?.recurring) return;
    await updateRecurringTransaction(loaded.db, replaceRecurring(loaded.recurring, edited));
    toast.show('保存しました', { kind: 'success' });
    navigate('/recurring');
  }

  async function stop() {
    if (!loaded || stopping) return;
    setStopping(true);
    try {
      await deleteRecurringTransaction(loaded.db, id);
    } catch {
      toast.show('停止できませんでした', { kind: 'error' });
      return;
    } finally {
      setStopping(false);
      setConfirming(false);
    }
    toast.show('停止しました', { kind: 'success' });
    navigate('/recurring');
  }

  function body() {
    if (!loaded) return <p>読み込み中…</p>;
    const { recurring, categories, accounts } = loaded;
    if (!recurring) return <p>定期取引が見つかりません。停止されたのかもしれません。</p>;
    return (
      <>
        <RecurringForm
          categories={categories}
          accounts={accounts}
          defaults={recurring}
          onSubmit={save}
        />
        <button type="button" class="edit-transaction-delete" onClick={() => setConfirming(true)}>
          この定期取引を停止する
        </button>
        <ConfirmDialog
          open={confirming}
          title="定期取引を停止しますか？"
          confirmLabel="停止する"
          danger
          onConfirm={() => void stop()}
          onCancel={() => setConfirming(false)}
        >
          <p>これから先の取引を起こさなくなります。起こし済みの取引は残ります。</p>
        </ConfirmDialog>
      </>
    );
  }

  return (
    <>
      <h2>定期取引の編集</h2>
      {body()}
    </>
  );
}
