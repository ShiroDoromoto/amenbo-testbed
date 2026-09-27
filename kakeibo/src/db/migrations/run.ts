import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';

/** バージョンを1つ上げる移行。`version` は、この移行を当てたあとのスキーマのバージョン。 */
export interface Migration<Schema = unknown> {
  version: number;
  /**
   * ストアや索引の作り替えと、データの書き換えをする。
   * データは `tx` から読み書きする。`await` してよいのは `tx` の要求だけで、ほかを待つとトランザクションが閉じる。
   */
  migrate(
    db: IDBPDatabase<Schema>,
    tx: IDBPTransaction<Schema, StoreNames<Schema>[], 'versionchange'>,
  ): void | Promise<void>;
}

/** 移行の並びを確かめ、最後のバージョンを返す。バージョンは 1 から始まり、1 ずつ上がっていなければならない。 */
export function latestVersion<Schema>(migrations: readonly Migration<Schema>[]): number {
  migrations.forEach((migration, i) => {
    if (migration.version !== i + 1) {
      throw new Error(
        `Migration at index ${i} has version ${migration.version}, expected ${i + 1}`,
      );
    }
  });
  if (migrations.length === 0) {
    throw new Error('At least one migration is required');
  }
  return migrations.length;
}

/**
 * `oldVersion` より新しく `newVersion` までの移行を、古い順に1つずつ当てる。
 * どれかが失敗したらトランザクションを中断し、DB は開く前のバージョンのまま残る。
 * 失敗は `openDB` の reject で呼び出し元に届く。
 */
export async function applyMigrations<Schema>(
  migrations: readonly Migration<Schema>[],
  db: IDBPDatabase<Schema>,
  tx: IDBPTransaction<Schema, StoreNames<Schema>[], 'versionchange'>,
  oldVersion: number,
  newVersion: number,
): Promise<void> {
  try {
    for (const migration of migrations) {
      if (migration.version > oldVersion && migration.version <= newVersion) {
        await migration.migrate(db, tx);
      }
    }
  } catch (error) {
    console.error('Migration failed', error);
    // 中断すると tx.done も reject される。失敗は openDB の reject で届くので、ここでは捨てる。
    tx.done.catch(() => {});
    tx.abort();
  }
}
