import {
  centsToAmount,
  formatBrasiliaTime,
  formatCountdown,
  formatCurrency,
  formatDate,
  formatPercent,
  formatRelativeDate,
  formatTime,
  localDateKey,
  maskEmail,
  parseCentsInput,
  toDateKey,
  toExpenseDateTime,
} from './format';

describe('formatCurrency', () => {
  it.each([
    [5890, 'R$ 5.890,00'],
    [39.9, 'R$ 39,90'],
    [0, 'R$ 0,00'],
    [1234567.891, 'R$ 1.234.567,89'],
  ])('formata %p como %p', (value, expected) => {
    expect(formatCurrency(value)).toBe(expected);
  });
});

describe('toDateKey', () => {
  it('mantém o dia de DateOnly e de DateTime sem fuso', () => {
    expect(toDateKey('2026-10-20')).toBe('2026-10-20');
    expect(toDateKey('2026-10-20T00:00:00')).toBe('2026-10-20');
  });

  it('converte DateTime com fuso para o dia local do aparelho', () => {
    for (const value of [
      '2026-10-15T01:49:04.82Z',
      '2026-10-15T23:30:00Z',
      '2026-10-15T12:00:00-03:00',
    ]) {
      expect(toDateKey(value)).toBe(localDateKey(new Date(value)));
    }
  });
});

describe('formatDate', () => {
  it('usa dia com dois dígitos, mês abreviado e ano', () => {
    expect(formatDate('2026-10-05')).toBe('05 out 2026');
    expect(formatDate('2025-12-31')).toBe('31 dez 2025');
  });
});

describe('formatRelativeDate', () => {
  const now = new Date(2026, 9, 21, 10, 0); // 21/10/2026, horário local

  it.each([
    ['2026-10-21', 'Hoje'],
    ['2026-10-20', 'Ontem'],
    ['2026-10-05', '05 out 2026'],
  ])('%p vira %p', (dateKey, expected) => {
    expect(formatRelativeDate(dateKey, now)).toBe(expected);
  });

  it('trata a virada de mês para "Ontem"', () => {
    expect(formatRelativeDate('2026-09-30', new Date(2026, 9, 1))).toBe('Ontem');
  });
});

describe('parseCentsInput / centsToAmount', () => {
  it.each([
    ['', 0],
    ['0', 0],
    ['5', 5],
    ['R$ 12,34', 1234],
    ['R$ 1.234,567', 1234567],
    ['0001', 1],
  ])('%p vira %p centavos', (text, cents) => {
    expect(parseCentsInput(text)).toBe(cents);
  });

  it('limita a quantidade de dígitos', () => {
    expect(parseCentsInput('9'.repeat(20))).toBe(999999999999);
  });

  it('converte centavos para reais sem perder precisão', () => {
    expect(centsToAmount(123456)).toBe(1234.56);
    expect(JSON.stringify({ amount: centsToAmount(3990) })).toBe('{"amount":39.9}');
  });
});

describe('toExpenseDateTime', () => {
  const now = new Date(2026, 9, 22, 9, 30);

  it('usa o horário atual quando a data é hoje', () => {
    expect(toExpenseDateTime('2026-10-22', now)).toBe(now.toISOString());
  });

  it('usa meio-dia local em outros dias, mantendo o dia ao converter de volta', () => {
    const iso = toExpenseDateTime('2026-10-05', now);
    expect(iso).toBe(new Date(2026, 9, 5, 12).toISOString());
    expect(toDateKey(iso)).toBe('2026-10-05');
  });
});

describe('formatPercent', () => {
  it.each([
    [71.09, '71,1%'],
    [12, '12%'],
    [0, '0%'],
    [3.04, '3%'],
  ])('%p vira %p', (value, expected) => {
    expect(formatPercent(value)).toBe(expected);
  });
});

describe('maskEmail', () => {
  it('mostra o início do usuário e o domínio inteiro', () => {
    expect(maskEmail('nilton@gmail.com')).toBe('ni***@gmail.com');
    expect(maskEmail('  ana.souza@micash.com.br ')).toBe('an***@micash.com.br');
  });

  it('em usuários curtos, mostra só a primeira letra', () => {
    expect(maskEmail('ana@b.com')).toBe('a***@b.com');
    expect(maskEmail('a@b.com')).toBe('a***@b.com');
  });

  it('sem @ válido, devolve o texto como está', () => {
    expect(maskEmail('sem-arroba')).toBe('sem-arroba');
    expect(maskEmail('@b.com')).toBe('@b.com');
  });
});

describe('formatCountdown', () => {
  it('formata minutos e segundos, arredondando para cima', () => {
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(59)).toBe('0:59');
    expect(formatCountdown(4.2)).toBe('0:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});

describe('formatTime', () => {
  it('mostra hora e minuto no fuso do aparelho', () => {
    const value = new Date(2026, 10, 2, 9, 5).toISOString();
    expect(formatTime(value)).toBe('09:05');
  });

  it('valor inválido vira texto vazio', () => {
    expect(formatTime('ontem')).toBe('');
  });
});

describe('formatBrasiliaTime', () => {
  it('mostra o horário de Brasília (UTC−3), independente do fuso do aparelho', () => {
    expect(formatBrasiliaTime('2026-12-01T03:00:00Z')).toBe('00:00');
    expect(formatBrasiliaTime('2026-11-10T17:32:00Z')).toBe('14:32');
    expect(formatBrasiliaTime('2026-11-10T01:05:00Z')).toBe('22:05');
  });

  it('devolve vazio para datas inválidas', () => {
    expect(formatBrasiliaTime('não é data')).toBe('');
  });
});
