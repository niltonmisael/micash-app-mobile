import {
  currentPeriod,
  lastPeriods,
  periodLabel,
  samePeriod,
  shiftPeriod,
  shortMonthLabel,
} from './period';

describe('currentPeriod', () => {
  it('usa o mês local, de 1 a 12', () => {
    expect(currentPeriod(new Date(2026, 9, 23))).toEqual({ year: 2026, month: 10 });
    expect(currentPeriod(new Date(2026, 0, 1))).toEqual({ year: 2026, month: 1 });
  });
});

describe('shiftPeriod', () => {
  it('avança e volta meses atravessando o ano', () => {
    expect(shiftPeriod({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftPeriod({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
    expect(shiftPeriod({ year: 2026, month: 10 }, -14)).toEqual({ year: 2025, month: 8 });
  });
});

describe('lastPeriods', () => {
  it('lista os meses do mais antigo ao informado', () => {
    expect(lastPeriods({ year: 2026, month: 2 }, 4)).toEqual([
      { year: 2025, month: 11 },
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
  });
});

describe('periodLabel / shortMonthLabel', () => {
  const now = new Date(2026, 9, 23);

  it.each([
    [{ year: 2026, month: 10 }, 'Este mês'],
    [{ year: 2026, month: 9 }, 'Mês anterior'],
    [{ year: 2026, month: 8 }, 'agosto de 2026'],
    [{ year: 2025, month: 12 }, 'dezembro de 2025'],
  ])('%p vira %p', (period, label) => {
    expect(periodLabel(period, now)).toBe(label);
  });

  it('dá o rótulo curto do mês', () => {
    expect(shortMonthLabel({ year: 2026, month: 5 })).toBe('Mai');
    expect(shortMonthLabel({ year: 2026, month: 10 })).toBe('Out');
  });

  it('compara períodos', () => {
    expect(samePeriod({ year: 2026, month: 10 }, { year: 2026, month: 10 })).toBe(true);
    expect(samePeriod({ year: 2026, month: 10 }, { year: 2025, month: 10 })).toBe(false);
  });
});
