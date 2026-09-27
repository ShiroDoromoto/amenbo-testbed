import { expect, test } from 'vitest';
import {
  readTransactionListQuery,
  writeTransactionListQuery,
  type TransactionListQuery,
} from './transactionListQuery.ts';

const today = '2026-09-28';

const empty: TransactionListQuery = {
  month: '2026-09-01',
  accountId: '',
  type: '',
  categoryId: '',
  keyword: '',
  minAmount: '',
  maxAmount: '',
};

test('クエリが空なら、今日の月で何も絞り込まない', () => {
  expect(readTransactionListQuery(new URLSearchParams(), today)).toEqual(empty);
});

test('クエリから月と絞り込みの条件を読む', () => {
  const query = new URLSearchParams(
    'month=2025-12&account=a1&type=income&category=c1&memo=%E7%B5%A6%E6%96%99&min=1%2C000&max=abc',
  );
  expect(readTransactionListQuery(query, today)).toEqual({
    month: '2025-12-01',
    accountId: 'a1',
    type: 'income',
    categoryId: 'c1',
    keyword: '給料',
    minAmount: '1,000',
    maxAmount: 'abc',
  });
});

test.each(['2026-13', '2026-9', '202609', 'x'])('読めない月 %j は今日の月にする', (month) => {
  expect(readTransactionListQuery(new URLSearchParams({ month }), today).month).toBe('2026-09-01');
});

test('収支区分が収入・支出でなければ、すべての区分にする', () => {
  expect(readTransactionListQuery(new URLSearchParams({ type: 'transfer' }), today).type).toBe('');
});

test('絞り込まない項目と今日の月は、クエリに書かない', () => {
  expect(writeTransactionListQuery(empty, today).toString()).toBe('');
  expect(
    writeTransactionListQuery(
      { ...empty, month: '2026-08-01', keyword: '食 費' },
      today,
    ).toString(),
  ).toBe('month=2026-08&memo=%E9%A3%9F+%E8%B2%BB');
});

test('書いたクエリを読むと、元の条件に戻る', () => {
  const query: TransactionListQuery = {
    month: '2024-02-01',
    accountId: 'a1',
    type: 'expense',
    categoryId: 'c1',
    keyword: 'a&b=c',
    minAmount: '100',
    maxAmount: '2,000',
  };
  expect(readTransactionListQuery(writeTransactionListQuery(query, today), today)).toEqual(query);
});
