import { render } from 'preact';
import { afterEach, expect, test } from 'vitest';
import { ExpensePaceSummary } from './ExpensePaceSummary.tsx';

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
});

function items() {
  return [...document.querySelectorAll('.expense-pace-item')].map((item) => [
    item.querySelector('dt')?.textContent,
    item.querySelector('dd')?.textContent,
  ]);
}

test('1日あたりの平均と月末までの見込みを出し、計算に使った期間と支出を添える', () => {
  render(
    <ExpensePaceSummary
      pace={{
        spent: 81200,
        elapsedDays: 28,
        daysInMonth: 30,
        dailyAverage: 2900,
        projected: 87000,
      }}
      monthNumber={9}
    />,
    document.body,
  );

  expect(items()).toEqual([
    ['1日あたりの平均', '2,900円'],
    ['月末までの見込み', '87,000円'],
  ]);
  expect(document.querySelector('.expense-pace-note')?.textContent).toBe(
    '9月1日〜28日（28日間）の支出 81,200円 から計算しています。',
  );
});

test('月の 1 日には、期間を 1 日だけで書く', () => {
  render(
    <ExpensePaceSummary
      pace={{ spent: 0, elapsedDays: 1, daysInMonth: 31, dailyAverage: 0, projected: 0 }}
      monthNumber={10}
    />,
    document.body,
  );

  expect(items()).toEqual([
    ['1日あたりの平均', '0円'],
    ['月末までの見込み', '0円'],
  ]);
  expect(document.querySelector('.expense-pace-note')?.textContent).toBe(
    '10月1日（1日間）の支出 0円 から計算しています。',
  );
});
