import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { useToast } from '../../components/Toast/index.ts';
import type { Category } from '../../domain/category.ts';
import type { IncomeExpenseType } from '../../domain/transaction.ts';
import { openKakeiboDB, type KakeiboDBConnection } from '../../db/index.ts';
import { addCategory, listCategories, updateCategory } from '../../db/repositories/categories.ts';
import { validateCategoryName } from './validateCategoryName.ts';
import './categoryList.css';

const typeLabels: Record<IncomeExpenseType, string> = {
  expense: '支出',
  income: '収入',
};

// 区分の選択肢と一覧を並べる順。取引の入力フォームに合わせて、支出を先にする。
const typeOrder: readonly IncomeExpenseType[] = ['expense', 'income'];

/** 追加したカテゴリの色。色を選べるようになるまでは、この灰色にする。 */
export const newCategoryColor = '#868e96';

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

/**
 * カテゴリの管理画面。カテゴリを収支区分ごとに並び順で出し、追加と名前の変更ができる。
 * `ToastProvider` の中で使う。
 */
export function CategoryList({ dbName }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
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
  async function add(type: IncomeExpenseType, name: string): Promise<boolean> {
    if (!loaded) return false;
    try {
      await addCategory(loaded.db, {
        name,
        type,
        color: newCategoryColor,
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
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      ) : (
        <p>読み込み中…</p>
      )}
    </>
  );
}

type AddFormProps = {
  categories: readonly Category[];
  onAdd: (type: IncomeExpenseType, name: string) => Promise<boolean>;
};

/** カテゴリを1件足すフォーム。 */
function AddCategoryForm({ categories, onAdd }: AddFormProps) {
  const [type, setType] = useState<IncomeExpenseType>('expense');
  const [name, setName] = useState('');
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
      if (await onAdd(type, result.name)) {
        setName('');
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
};

/** カテゴリ1件の行。「名前を変える」を押すと、その場で名前の入力欄に変わる。 */
function CategoryRow({ category, categories, onRename }: RowProps) {
  const [editing, setEditing] = useState(false);
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
