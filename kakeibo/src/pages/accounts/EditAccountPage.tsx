import { useEffect, useState } from 'preact/hooks';
import type { Account } from '../../domain/account.ts';
import { useToast } from '../../components/Toast/index.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import { getAccount, updateAccount, type NewAccount } from '../../db/repositories/accounts.ts';
import { navigate } from '../../router/index.ts';
import { AccountForm } from './AccountForm.tsx';

type Loaded = {
  db: KakeiboDBConnection;
  account: Account | undefined;
};

type Props = {
  /** 編集する口座の id。 */
  id: string;
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

/**
 * 口座の編集画面。id の口座を DB から読んでフォームに入れ、保存したら口座の一覧に戻る。
 * フォームで扱わない欄は、読んだ口座のまま残す。
 */
export function EditAccountPage({ id, dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const toast = useToast();

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const account = await getAccount(db, id);
      if (!cancelled) setLoaded({ db, account });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [id, dbName]);

  async function save(edited: NewAccount) {
    if (!loaded?.account) return;
    await updateAccount(loaded.db, { ...loaded.account, ...edited, id: loaded.account.id });
    toast.show('保存しました', { kind: 'success' });
    navigate('/accounts');
  }

  function body() {
    if (!loaded) return <p>読み込み中…</p>;
    if (!loaded.account) return <p>口座が見つかりません。</p>;
    return <AccountForm defaults={loaded.account} onSubmit={save} />;
  }

  return (
    <>
      <h2>口座の編集</h2>
      {body()}
    </>
  );
}
