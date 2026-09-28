import { describe, expect, it } from 'vitest';
import type { Category } from '../../domain/category.ts';
import type { Transaction } from '../../domain/transaction.ts';
import { calculateReport, reportMonths, yearPeriod } from './calculateReport.ts';

let nextId = 0;

function entry(
  type: 'income' | 'expense',
  date: string,
  categoryId: string,
  amount: number,
): Transaction {
  return { id: `t${nextId++}`, type, date, amount, memo: '', categoryId, accountId: 'bank' };
}

function category(id: string, type: 'income' | 'expense', order: number): Category {
  return { id, name: id, type, color: '#000000', order };
}

/** 1月から12月までの 12 件を作る。`values` に無い月は 0 にする。 */
function months(values: Record<number, number>): number[] {
  return Array.from({ length: 12 }, (_, i) => values[i + 1] ?? 0);
}

const categories = [
  category('food', 'expense', 0),
  category('rent', 'expense', 1),
  category('salary', 'income', 0),
];

describe('yearPeriod', () => {
  it('その年の 1月1日から 12月31日までにする', () => {
    expect(yearPeriod(2026)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(yearPeriod(999)).toEqual({ from: '0999-01-01', to: '0999-12-31' });
  });
});

describe('reportMonths', () => {
  it('期間がかかる月の 1 日を、年をまたいで古い順に返す', () => {
    expect(reportMonths({ from: '2025-11-20', to: '2026-01-05' })).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
    ]);
  });

  it('1か月の中の期間なら、その月だけを返す', () => {
    expect(reportMonths({ from: '2026-03-10', to: '2026-03-10' })).toEqual(['2026-03-01']);
  });

  it('9999年12月で終わる期間も返す', () => {
    expect(reportMonths({ from: '9999-11-01', to: '9999-12-31' })).toEqual([
      '9999-11-01',
      '9999-12-01',
    ]);
  });

  it('始まりが終わりより後なら空を返す', () => {
    expect(reportMonths({ from: '2026-02-01', to: '2026-01-31' })).toEqual([]);
  });
});

describe('calculateReport', () => {
  it('収入と支出を分けて、カテゴリごと・月ごとに合計する', () => {
    const transactions = [
      entry('expense', '2026-01-05', 'food', 1000),
      entry('expense', '2026-01-20', 'food', 500),
      entry('expense', '2026-03-10', 'food', 2000),
      entry('expense', '2026-12-31', 'rent', 80000),
      entry('income', '2026-01-25', 'salary', 250000),
    ];
    expect(calculateReport(transactions, categories, yearPeriod(2026))).toEqual({
      months: Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}-01`),
      expense: {
        rows: [
          { categoryId: 'food', months: months({ 1: 1500, 3: 2000 }), total: 3500 },
          { categoryId: 'rent', months: months({ 12: 80000 }), total: 80000 },
        ],
        months: months({ 1: 1500, 3: 2000, 12: 80000 }),
        total: 83500,
      },
      income: {
        rows: [{ categoryId: 'salary', months: months({ 1: 250000 }), total: 250000 }],
        months: months({ 1: 250000 }),
        total: 250000,
      },
    });
  });

  it('その年の取引だけを数え、振替は数えない', () => {
    const transactions: Transaction[] = [
      entry('expense', '2025-12-31', 'food', 1),
      entry('expense', '2026-01-01', 'food', 10),
      entry('expense', '2027-01-01', 'food', 100),
      {
        id: 'transfer',
        type: 'transfer',
        date: '2026-05-01',
        amount: 30000,
        memo: '',
        accountId: 'bank',
        toAccountId: 'wallet',
      },
    ];
    const report = calculateReport(transactions, categories, yearPeriod(2026));
    expect(report.expense.rows).toEqual([
      { categoryId: 'food', months: months({ 1: 10 }), total: 10 },
    ]);
    expect(report.income).toEqual({ rows: [], months: months({}), total: 0 });
  });

  it('行はカテゴリの並び順にし、消されたカテゴリは後ろに id の順で置く', () => {
    const transactions = [
      entry('expense', '2026-02-01', 'gone-b', 1),
      entry('expense', '2026-02-01', 'rent', 1),
      entry('expense', '2026-02-01', 'gone-a', 1),
      entry('expense', '2026-02-01', 'food', 1),
    ];
    const report = calculateReport(transactions, categories, yearPeriod(2026));
    expect(report.expense.rows.map((row) => row.categoryId)).toEqual([
      'food',
      'rent',
      'gone-a',
      'gone-b',
    ]);
  });

  it('年をまたぐ期間では、期間に入る日の取引だけを、列の月に振り分ける', () => {
    const transactions = [
      entry('expense', '2025-11-19', 'food', 1),
      entry('expense', '2025-11-20', 'food', 10),
      entry('expense', '2025-12-31', 'food', 100),
      entry('expense', '2026-01-05', 'rent', 1000),
      entry('expense', '2026-01-06', 'rent', 10000),
    ];
    const report = calculateReport(transactions, categories, {
      from: '2025-11-20',
      to: '2026-01-05',
    });
    expect(report.months).toEqual(['2025-11-01', '2025-12-01', '2026-01-01']);
    expect(report.expense).toEqual({
      rows: [
        { categoryId: 'food', months: [10, 100, 0], total: 110 },
        { categoryId: 'rent', months: [0, 0, 1000], total: 1000 },
      ],
      months: [10, 100, 1000],
      total: 1110,
    });
  });

  it('金額が整数でなければ例外を投げる', () => {
    expect(() =>
      calculateReport([entry('expense', '2026-01-01', 'food', 0.5)], categories, yearPeriod(2026)),
    ).toThrow(RangeError);
  });

  it('合計が扱える範囲を超えたら例外を投げる', () => {
    const transactions = [
      entry('income', '2026-01-01', 'salary', Number.MAX_SAFE_INTEGER),
      entry('income', '2026-02-01', 'salary', 1),
    ];
    expect(() => calculateReport(transactions, categories, yearPeriod(2026))).toThrow(RangeError);
  });
});
