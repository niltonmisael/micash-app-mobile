import {
  NEW_PASSWORD_SAME_AS_CURRENT,
  PASSWORD_REQUIREMENTS,
  PASSWORD_RULES,
  isValidEmail,
  isValidPassword,
  isValidResetCode,
  passwordStrength,
  validateCategoryForm,
  validateChangePasswordForm,
  validateProfileForm,
  validateRegisterForm,
  validateResetPasswordForm,
  validateSavingsGoalForm,
  validateSavingsMovementForm,
  validateTransactionForm,
} from './validation';

describe('isValidEmail', () => {
  it.each(['seu@email.com', 'nome.sobrenome@micash.com.br', '  user@dominio.io  '])(
    'aceita %p',
    (value) => {
      expect(isValidEmail(value)).toBe(true);
    },
  );

  it.each(['', 'seu', 'seu@', 'seu@email', '@email.com', 'seu email@email.com'])(
    'rejeita %p',
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});

describe('isValidPassword', () => {
  it.each(['Senha123!', 'Abcdefg1?', 'Xy9*abcd', 'Micash.2026'])('aceita %p', (value) => {
    expect(isValidPassword(value)).toBe(true);
  });

  it.each([
    ['curta', 'Ab1!'],
    ['sem maiúscula', 'senha123!'],
    ['sem minúscula', 'SENHA123!'],
    ['sem número', 'Senhaaaa!'],
    ['sem especial', 'Senha1234'],
    ['especial não aceito pela API', 'Senha123@'],
  ])('rejeita senha %s', (_, value) => {
    expect(isValidPassword(value)).toBe(false);
  });
});

describe('validateRegisterForm', () => {
  const valid = {
    name: 'Nilton Misael',
    email: 'nilton@micash.com.br',
    password: 'Senha123!',
    confirmPassword: 'Senha123!',
  };

  it('não retorna erros para um formulário válido', () => {
    expect(validateRegisterForm(valid)).toEqual({});
  });

  it('exige todos os campos', () => {
    expect(
      validateRegisterForm({ name: '  ', email: '', password: '', confirmPassword: '' }),
    ).toEqual({
      name: 'Informe seu nome completo.',
      email: 'Informe seu e-mail.',
      password: 'Informe uma senha.',
      confirmPassword: 'Confirme sua senha.',
    });
  });

  it('valida formato do e-mail, regra da senha e confirmação', () => {
    expect(
      validateRegisterForm({
        ...valid,
        email: 'nilton@',
        password: 'fraca',
        confirmPassword: 'outra',
      }),
    ).toEqual({
      email: 'E-mail inválido.',
      password: PASSWORD_REQUIREMENTS,
      confirmPassword: 'As senhas não coincidem.',
    });
  });
});

describe('validateTransactionForm', () => {
  const today = '2026-10-22';
  const valid = { title: 'Mercado', amountCents: 25050, date: today, category: 3, paymentType: 4 };

  it('aceita receita e despesa válidas', () => {
    expect(validateTransactionForm('income', { ...valid, paymentType: undefined }, today)).toEqual(
      {},
    );
    expect(validateTransactionForm('expense', valid, today)).toEqual({});
  });

  it('exige descrição, valor maior que zero, data e categoria', () => {
    expect(
      validateTransactionForm(
        'income',
        { title: '  ', amountCents: 0, date: '', category: undefined },
        today,
      ),
    ).toEqual({
      title: 'Informe uma descrição.',
      amount: 'Informe um valor maior que zero.',
      date: 'Informe a data.',
      category: 'Selecione uma categoria.',
    });
  });

  it('recusa despesa com data futura e sem forma de pagamento', () => {
    expect(
      validateTransactionForm(
        'expense',
        { ...valid, date: '2026-10-23', paymentType: undefined },
        today,
      ),
    ).toEqual({
      date: 'A data da despesa não pode ser futura.',
      paymentType: 'Selecione a forma de pagamento.',
    });
  });

  it('aceita receita com data futura (a API permite)', () => {
    expect(validateTransactionForm('income', { ...valid, date: '2026-11-05' }, today)).toEqual({});
  });

  it('aceita categoria com valor 0 (ex.: PaymentType.Cash = 0)', () => {
    expect(validateTransactionForm('expense', { ...valid, paymentType: 0 }, today)).toEqual({});
  });
});

describe('validateCategoryForm', () => {
  it('aceita nome, ícone e cor preenchidos', () => {
    expect(
      validateCategoryForm({ name: 'Mercado', icon: 'shopping-cart', color: '#F58A3C' }),
    ).toEqual({});
  });

  it('exige os três campos', () => {
    expect(validateCategoryForm({ name: '   ' })).toEqual({
      name: 'Informe o nome da categoria.',
      icon: 'Escolha um ícone.',
      color: 'Escolha uma cor.',
    });
  });
});

describe('validateProfileForm', () => {
  it('aceita nome e e-mail válidos', () => {
    expect(validateProfileForm({ name: 'Nilton', email: 'nilton@micash.com.br' })).toEqual({});
  });

  it('exige nome e e-mail válido', () => {
    expect(validateProfileForm({ name: ' ', email: '' })).toEqual({
      name: 'Informe seu nome completo.',
      email: 'Informe seu e-mail.',
    });
    expect(validateProfileForm({ name: 'Nilton', email: 'nilton@' })).toEqual({
      email: 'E-mail inválido.',
    });
  });
});

describe('validateChangePasswordForm', () => {
  it('aceita senha atual, nova senha válida e confirmação igual', () => {
    expect(
      validateChangePasswordForm({
        currentPassword: 'qualquer',
        newPassword: 'Nova123!',
        confirmPassword: 'Nova123!',
      }),
    ).toEqual({});
  });

  it('exige os campos, a regra da API e a confirmação', () => {
    expect(
      validateChangePasswordForm({
        currentPassword: '',
        newPassword: 'fraca',
        confirmPassword: 'x',
      }),
    ).toEqual({
      currentPassword: 'Informe a senha atual.',
      newPassword: PASSWORD_REQUIREMENTS,
      confirmPassword: 'As senhas não coincidem.',
    });
  });

  it('recusa a nova senha idêntica à atual, como a API', () => {
    expect(
      validateChangePasswordForm({
        currentPassword: 'Atual123!',
        newPassword: 'Atual123!',
        confirmPassword: 'Atual123!',
      }),
    ).toEqual({ newPassword: NEW_PASSWORD_SAME_AS_CURRENT });
  });

  it('compara o texto exato (maiúsculas e espaços contam)', () => {
    const base = { currentPassword: 'Atual123!', confirmPassword: '' };
    expect(
      validateChangePasswordForm({ ...base, newPassword: 'atual123!A' }).newPassword,
    ).toBeUndefined();
    expect(
      validateChangePasswordForm({ ...base, newPassword: 'Atual123! ' }).newPassword,
    ).toBeUndefined();
  });

  it('o aviso de formato tem prioridade sobre o de senha repetida', () => {
    expect(
      validateChangePasswordForm({
        currentPassword: 'fraca',
        newPassword: 'fraca',
        confirmPassword: 'fraca',
      }).newPassword,
    ).toBe(PASSWORD_REQUIREMENTS);
  });
});

describe('passwordStrength', () => {
  it.each([
    ['', 'fraca', 0],
    ['abc', 'fraca', 1],
    ['Abcdefgh', 'média', 3],
    ['Abcdefg1', 'média', 4],
    ['Abcdef1!', 'forte', 5],
  ])('%p é %p', (value, level, score) => {
    expect(passwordStrength(value)).toEqual({ level, score });
  });
});

describe('validateSavingsGoalForm', () => {
  const valid = { name: 'Viagem', targetCents: 500000, icon: 'plane', color: '#F58A3C' };

  it('aceita uma meta completa', () => {
    expect(validateSavingsGoalForm(valid)).toEqual({});
  });

  it('exige nome (até 100 caracteres), valor alvo, ícone e cor', () => {
    expect(
      validateSavingsGoalForm({ name: '  ', targetCents: 0, icon: undefined, color: undefined }),
    ).toEqual({
      name: 'Informe o nome da meta.',
      target: 'Informe um valor maior que zero.',
      icon: 'Escolha um ícone.',
      color: 'Escolha uma cor.',
    });
    expect(validateSavingsGoalForm({ ...valid, name: 'a'.repeat(101) }).name).toBe(
      'O nome deve ter no máximo 100 caracteres.',
    );
  });
});

describe('validateSavingsMovementForm', () => {
  const today = '2026-10-21';

  it('aceita valor positivo com data até hoje', () => {
    expect(validateSavingsMovementForm({ amountCents: 30000, date: today }, today)).toEqual({});
  });

  it('recusa valor zero e data futura', () => {
    expect(validateSavingsMovementForm({ amountCents: 0, date: '2026-10-22' }, today)).toEqual({
      amount: 'Informe um valor maior que zero.',
      date: 'A data não pode ser futura.',
    });
  });

  it('na retirada, recusa valor maior que o guardado', () => {
    expect(
      validateSavingsMovementForm({ amountCents: 30001, date: today, maxCents: 30000 }, today),
    ).toEqual({ amount: 'O valor é maior que o guardado na meta.' });
    expect(
      validateSavingsMovementForm({ amountCents: 30000, date: today, maxCents: 30000 }, today),
    ).toEqual({});
  });
});

describe('PASSWORD_RULES', () => {
  it('são as 5 regras do PasswordValidator, avaliadas uma a uma', () => {
    expect(PASSWORD_RULES.map((rule) => rule.test('abc'))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(PASSWORD_RULES.every((rule) => rule.test('Abcdef1!'))).toBe(true);
  });
});

describe('validateResetPasswordForm', () => {
  it('aceita senha válida confirmada', () => {
    expect(
      validateResetPasswordForm({ newPassword: 'Abcdef1!', confirmPassword: 'Abcdef1!' }),
    ).toEqual({});
  });

  it('exige as regras da API e a confirmação igual', () => {
    expect(validateResetPasswordForm({ newPassword: '', confirmPassword: '' })).toEqual({
      newPassword: 'Informe a nova senha.',
      confirmPassword: 'Confirme a nova senha.',
    });
    expect(
      validateResetPasswordForm({ newPassword: 'abcdefgh', confirmPassword: 'abcdefgh' })
        .newPassword,
    ).toBe(PASSWORD_REQUIREMENTS);
    expect(
      validateResetPasswordForm({ newPassword: 'Abcdef1!', confirmPassword: 'Abcdef1?' }),
    ).toEqual({ confirmPassword: 'As senhas não coincidem.' });
  });
});

describe('isValidResetCode', () => {
  it('aceita só dígitos no tamanho informado pela API', () => {
    expect(isValidResetCode('004213', 6)).toBe(true);
    expect(isValidResetCode('00421', 6)).toBe(false);
    expect(isValidResetCode('00421a', 6)).toBe(false);
    expect(isValidResetCode('0042133', 6)).toBe(false);
  });
});
