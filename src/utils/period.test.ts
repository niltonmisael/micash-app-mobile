import {
  currentPeriod,
  lastPeriods,
  periodEndKey,
  periodFromDateKey,
  periodLabel,
  samePeriod,
  shiftPeriod,
  shortMonthLabel,
  shortMonthYearLabel,
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

describe('prazo das metas de economia', () => {
  it('mostra o mês abreviado com o ano', () => {
    expect(shortMonthYearLabel({ year: 2026, month: 12 })).toBe('dez/2026');
    expect(shortMonthYearLabel({ year: 2027, month: 3 })).toBe('mar/2027');
  });

  it('envia o último dia do mês, inclusive em fevereiro bissexto', () => {
    expect(periodEndKey({ year: 2026, month: 12 })).toBe('2026-12-31');
    expect(periodEndKey({ year: 2026, month: 4 })).toBe('2026-04-30');
    expect(periodEndKey({ year: 2028, month: 2 })).toBe('2028-02-29');
  });

  it('lê o mês de uma data da API', () => {
    expect(periodFromDateKey('2026-12-31')).toEqual({ year: 2026, month: 12 });
  });
});
