import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { useToast } from '../../components/Toast/index.ts';
import type { Category } from '../../domain/category.ts';
import type { IncomeExpenseType } from '../../domain/transaction.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import {
  addCategory,
  deleteCategory,
  deleteCategoryAndReassign,
  listCategories,
  updateCategory,
} from '../../db/repositories/categories.ts';
import { listRecurringTransactions } from '../../db/repositories/recurring.ts';
import { countTransactionsByCategory } from '../../db/repositories/transactions.ts';
import { defaultCategoryColor } from './categoryColors.ts';
import { ColorPicker } from './ColorPicker.tsx';
import { DeleteCategoryDialog, type CategoryUsage } from './DeleteCategoryDialog.tsx';
import { validateCategoryName } from './validateCategoryName.ts';
import './categoryList.css';

const typeLabels: Record<IncomeExpenseType, string> = {
  expense: '支出',
  income: '収入',
};

// 区分の選択肢と一覧を並べる順。取引の入力フォームに合わせて、支出を先にする。
const typeOrder: readonly IncomeExpenseType[] = ['expense', 'income'];

type Loaded = {
  db: KakeiboDBConnection;
  categories: Category[];
};

type Props = {
  /** 開く DB の名前。テストで別の DB を使うときに渡す。 */
  dbName?: string;
};

/** 収支区分 `type` の末尾に並ぶ `order`。 */
function nextOrder(categories: readonly Category[], type: IncomeExpenseType): number {
  const orders = categories.filter((c) => c.type === type).map((c) => c.order);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
}

/** 付け替え先の候補。`category` と同じ収支区分の、ほかのカテゴリ。 */
function reassignCandidates(categories: readonly Category[], category: Category): Category[] {
  return categories.filter((c) => c.type === category.type && c.id !== category.id);
}

/**
 * カテゴリの管理画面。カテゴリを収支区分ごとに並び順で出し、追加・名前と色の変更・削除ができる。
 * 使われているカテゴリを消すときは、取引と定期取引の付け替え先を選ばせる。
 * `ToastProvider` の中で使う。
 */
export function CategoryList({ dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [deleting, setDeleting] = useState<CategoryUsage | null>(null);
  const toast = useToast();
  const id = useId();

  useEffect(() => {
    const opening = openKakeiboDB(dbName);
    let cancelled = false;
    void (async () => {
      const db = await opening;
      const categories = await listCategories(db);
      if (!cancelled) setLoaded({ db, categories });
    })();
    return () => {
      cancelled = true;
      void opening.then((db) => db.close());
    };
  }, [dbName]);

  async function reload(db: KakeiboDBConnection) {
    const categories = await listCategories(db);
    setLoaded({ db, categories });
  }

  /** 追加できたら `true` を返す。 */
  async function add(type: IncomeExpenseType, name: string, color: string): Promise<boolean> {
    if (!loaded) return false;
    try {
      await addCategory(loaded.db, {
        name,
        type,
        color,
        order: nextOrder(loaded.categories, type),
      });
    } catch {
      toast.show('追加できませんでした', { kind: 'error' });
      return false;
    }
    toast.show('追加しました', { kind: 'success' });
    await reload(loaded.db);
    return true;
  }

  /** 変えられたら `true` を返す。 */
  async function rename(category: Category, name: string): Promise<boolean> {
    if (!loaded) return false;
    try {
      await updateCategory(loaded.db, { ...category, name });
    } catch {
      toast.show('名前を変えられませんでした', { kind: 'error' });
      return false;
    }
    toast.show('名前を変えました', { kind: 'success' });
    await reload(loaded.db);
    return true;
  }

  /** 変えられたら `true` を返す。 */
  async function recolor(category: Category, color: string): Promise<boolean> {
    if (!loaded) return false;
    try {
      await updateCategory(loaded.db, { ...category, color });
    } catch {
      toast.show('色を変えられませんでした', { kind: 'error' });
      return false;
    }
    toast.show('色を変えました', { kind: 'success' });
    await reload(loaded.db);
    return true;
  }

  /** 使っている件数を数えて、削除の確認を出す。 */
  async function startDeleting(category: Category) {
    if (!loaded) return;
    const [transactions, recurrings] = await Promise.all([
      countTransactionsByCategory(loaded.db, category.id),
      listRecurringTransactions(loaded.db),
    ]);
    const usage: CategoryUsage = {
      category,
      transactions,
      recurrings: recurrings.filter((r) => r.type !== 'transfer' && r.categoryId === category.id)
        .length,
    };
    const used = usage.transactions + usage.recurrings > 0;
    if (used && reassignCandidates(loaded.categories, category).length === 0) {
      toast.show(
        `${typeLabels[category.type]}のカテゴリがほかに無いため、付け替え先を選べません。先にカテゴリを追加してください`,
        { kind: 'error' },
      );
      return;
    }
    setDeleting(usage);
  }

  async function remove(category: Category, toCategoryId: string | null) {
    if (!loaded) return;
    setDeleting(null);
    try {
      if (toCategoryId === null) {
        await deleteCategory(loaded.db, category.id);
      } else {
        await deleteCategoryAndReassign(loaded.db, category.id, toCategoryId);
      }
    } catch {
      toast.show('削除できませんでした', { kind: 'error' });
      return;
    }
    toast.show('削除しました', { kind: 'success' });
    await reload(loaded.db);
  }

  return (
    <>
      <h2>カテゴリ</h2>
      {loaded ? (
        <>
          <AddCategoryForm categories={loaded.categories} onAdd={add} />
          {typeOrder.map((type) => {
            const categories = loaded.categories.filter((c) => c.type === type);
            return (
              <section key={type} class="category-list-section" aria-labelledby={`${id}-${type}`}>
                <h3 id={`${id}-${type}`}>{typeLabels[type]}</h3>
                {categories.length === 0 ? (
                  <p>{typeLabels[type]}のカテゴリはまだありません。</p>
                ) : (
                  <ul class="category-list">
                    {categories.map((category) => (
                      <CategoryRow
                        key={category.id}
                        category={category}
                        categories={loaded.categories}
                        onRename={rename}
                        onRecolor={recolor}
                        onDelete={startDeleting}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          {deleting && (
            <DeleteCategoryDialog
              key={deleting.category.id}
              usage={deleting}
              candidates={reassignCandidates(loaded.categories, deleting.category)}
              onConfirm={(toCategoryId) => void remove(deleting.category, toCategoryId)}
              onCancel={() => setDeleting(null)}
            />
          )}
        </>
      ) : (
        <p>読み込み中…</p>
      )}
    </>
  );
}

type AddFormProps = {
  categories: readonly Category[];
  onAdd: (type: IncomeExpenseType, name: string, color: string) => Promise<boolean>;
};

/** カテゴリを1件足すフォーム。 */
function AddCategoryForm({ categories, onAdd }: AddFormProps) {
  const [type, setType] = useState<IncomeExpenseType>('expense');
  const [name, setName] = useState('');
  const [color, setColor] = useState(defaultCategoryColor);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (saving) return;
    const result = validateCategoryName(name, { type }, categories);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaving(true);
    try {
      if (await onAdd(type, result.name, color)) {
        setName('');
        setColor(defaultCategoryColor);
        setError(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    // 必須の確かめはブラウザに任せず、自前のメッセージで出す。
    <form class="category-add-form" noValidate onSubmit={handleSubmit}>
      <fieldset class="category-add-type">
        <legend>区分</legend>
        {typeOrder.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="type"
              value={value}
              checked={type === value}
              onChange={() => setType(value)}
            />
            {typeLabels[value]}
          </label>
        ))}
      </fieldset>
      <ColorPicker legend="色" value={color} onChange={setColor} />
      <div class="category-add-name">
        <label for={`${id}-name`}>新しいカテゴリの名前</label>
        <div class="category-name-control">
          <input
            id={`${id}-name`}
            name="name"
            value={name}
            required
            aria-invalid={error !== null || undefined}
            aria-describedby={error !== null ? `${id}-name-error` : undefined}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <button type="submit" class="category-primary-button" disabled={saving}>
            追加する
          </button>
        </div>
        {error !== null && (
          <p class="category-error" id={`${id}-name-error`}>
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

type RowProps = {
  category: Category;
  categories: readonly Category[];
  onRename: (category: Category, name: string) => Promise<boolean>;
  onRecolor: (category: Category, color: string) => Promise<boolean>;
  onDelete: (category: Category) => void;
};

/**
 * カテゴリ1件の行。「名前を変える」を押すと、その場で名前の入力欄に変わる。
 * 「色を変える」を押すと、その場で色の選択肢に変わる。「削除する」を押すと、削除の確認を出す。
 */
function CategoryRow({ category, categories, onRename, onRecolor, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [recoloring, setRecoloring] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // 押した行の入力欄に、すぐ打てるようにする。
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEditing() {
    setName(category.name);
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (saving) return;
    const result = validateCategoryName(name, { type: category.type, id: category.id }, categories);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.name === category.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      if (await onRename(category, result.name)) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const swatch = (
    <span class="category-swatch" style={{ backgroundColor: category.color }} aria-hidden="true" />
  );

  if (recoloring) {
    return (
      <li class="category-list-item">
        {swatch}
        <RecolorForm category={category} onSave={onRecolor} onClose={() => setRecoloring(false)} />
      </li>
    );
  }

  if (!editing) {
    return (
      <li class="category-list-item">
        {swatch}
        <span class="category-list-name">{category.name}</span>
        <button
          type="button"
          class="category-secondary-button"
          aria-label={`${category.name}の名前を変える`}
          onClick={startEditing}
        >
          名前を変える
        </button>
        <button
          type="button"
          class="category-secondary-button"
          aria-label={`${category.name}の色を変える`}
          onClick={() => setRecoloring(true)}
        >
          色を変える
        </button>
        <button
          type="button"
          class="category-secondary-button"
          aria-label={`${category.name}を削除する`}
          onClick={() => onDelete(category)}
        >
          削除する
        </button>
      </li>
    );
  }

  return (
    <li class="category-list-item">
      {swatch}
      <form class="category-rename-form" noValidate onSubmit={handleSubmit}>
        <div class="category-name-control">
          <input
            name="name"
            value={name}
            required
            aria-label={`${category.name}の新しい名前`}
            aria-invalid={error !== null || undefined}
            aria-describedby={error !== null ? `${id}-error` : undefined}
            ref={inputRef}
            onInput={(e) => setName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <button type="submit" class="category-primary-button" disabled={saving}>
            保存する
          </button>
          <button type="button" class="category-secondary-button" onClick={() => setEditing(false)}>
            キャンセル
          </button>
        </div>
        {error !== null && (
          <p class="category-error" id={`${id}-error`}>
            {error}
          </p>
        )}
      </form>
    </li>
  );
}

type RecolorFormProps = {
  category: Category;
  onSave: (category: Category, color: string) => Promise<boolean>;
  onClose: () => void;
};

/** 行の中で、カテゴリの色を選び直すフォーム。 */
function RecolorForm({ category, onSave, onClose }: RecolorFormProps) {
  const [color, setColor] = useState(category.color);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // いまの色の選択肢に、すぐ矢印キーで動けるようにする。
  useEffect(() => {
    const form = formRef.current;
    (
      form?.querySelector<HTMLInputElement>('input:checked') ?? form?.querySelector('input')
    )?.focus();
  }, []);

  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (saving) return;
    if (color === category.color) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      if (await onSave(category, color)) onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      class="category-recolor-form"
      ref={formRef}
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <ColorPicker legend={`${category.name}の色`} value={color} onChange={setColor} />
      <div class="category-name-control">
        <button type="submit" class="category-primary-button" disabled={saving}>
          保存する
        </button>
        <button type="button" class="category-secondary-button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
