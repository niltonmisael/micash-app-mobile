const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validação apenas de formato, sem verificar se o e-mail existe. */
export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export const PASSWORD_REQUIREMENTS =
  'A senha deve ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e um destes caracteres: ! ? * .';

/** Regras do PasswordValidator da MiCash.API, na ordem em que aparecem para o usuário. */
export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: 'Mínimo de 8 caracteres', test: (value) => value.length >= 8 },
  { label: 'Uma letra maiúscula', test: (value) => /[A-Z]/.test(value) },
  { label: 'Uma letra minúscula', test: (value) => /[a-z]/.test(value) },
  { label: 'Um número', test: (value) => /[0-9]/.test(value) },
  { label: 'Um destes caracteres: ! ? * .', test: (value) => /[!?*.]/.test(value) },
];

/**
 * Espelha o PasswordValidator da MiCash.API: mínimo de 8 caracteres, com maiúscula,
 * minúscula, número e um dos caracteres especiais aceitos pela API (! ? * .).
 */
export function isValidPassword(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

export type RegisterFormValues = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type RegisterFormErrors = Partial<Record<keyof RegisterFormValues, string>>;

export function validateRegisterForm(values: RegisterFormValues): RegisterFormErrors {
  const errors: RegisterFormErrors = {};

  if (!values.name.trim()) errors.name = 'Informe seu nome completo.';

  if (!values.email.trim()) errors.email = 'Informe seu e-mail.';
  else if (!isValidEmail(values.email)) errors.email = 'E-mail inválido.';

  if (!values.password) errors.password = 'Informe uma senha.';
  else if (!isValidPassword(values.password)) errors.password = PASSWORD_REQUIREMENTS;

  if (!values.confirmPassword) errors.confirmPassword = 'Confirme sua senha.';
  else if (values.confirmPassword !== values.password)
    errors.confirmPassword = 'As senhas não coincidem.';

  return errors;
}

export type TransactionKind = 'income' | 'expense';

export type TransactionFormValues = {
  title: string;
  amountCents: number;
  /** "AAAA-MM-DD" */
  date: string;
  /** Receita: valor do enum IncomeCategory. Despesa: id da categoria do usuário. */
  category?: number;
  /** Só despesa: valor do enum PaymentType. */
  paymentType?: number;
};

export type TransactionFormErrors = Partial<
  Record<'title' | 'amount' | 'date' | 'category' | 'paymentType', string>
>;

/**
 * Espelha IncomeValidator/ExpenseValidator da API (título obrigatório, valor > 0, despesa sem
 * data futura) e exige as escolhas que a API não valida, mas sem as quais o registro fica inválido
 * (categoria de receita fora do enum, categoria de despesa inexistente).
 */
export function validateTransactionForm(
  kind: TransactionKind,
  values: TransactionFormValues,
  today: string,
): TransactionFormErrors {
  const errors: TransactionFormErrors = {};

  if (!values.title.trim()) errors.title = 'Informe uma descrição.';
  if (values.amountCents <= 0) errors.amount = 'Informe um valor maior que zero.';

  if (!values.date) errors.date = 'Informe a data.';
  else if (kind === 'expense' && values.date > today)
    errors.date = 'A data da despesa não pode ser futura.';

  if (values.category === undefined) errors.category = 'Selecione uma categoria.';
  if (kind === 'expense' && values.paymentType === undefined)
    errors.paymentType = 'Selecione a forma de pagamento.';

  return errors;
}

export type CategoryFormValues = {
  name: string;
  icon?: string;
  color?: string;
};

export type CategoryFormErrors = Partial<Record<keyof CategoryFormValues, string>>;

/** Nome, ícone e cor são obrigatórios na criação (CategoryValidator); a edição na API não valida. */
export function validateCategoryForm(values: CategoryFormValues): CategoryFormErrors {
  const errors: CategoryFormErrors = {};
  if (!values.name.trim()) errors.name = 'Informe o nome da categoria.';
  if (!values.icon) errors.icon = 'Escolha um ícone.';
  if (!values.color) errors.color = 'Escolha uma cor.';
  return errors;
}

export type GoalFormValues = {
  categoryId?: number;
  amountCents: number;
};

export type GoalFormErrors = Partial<Record<'category' | 'amount', string>>;

/**
 * Espelha o ValidatorFinancialGoal da API (categoria e valor > 0). O mês vem de uma lista que
 * só oferece meses aceitos pela API (ano atual em diante).
 */
export function validateGoalForm(values: GoalFormValues): GoalFormErrors {
  const errors: GoalFormErrors = {};
  if (values.categoryId === undefined) errors.category = 'Selecione uma categoria.';
  if (values.amountCents <= 0) errors.amount = 'Informe um valor maior que zero.';
  return errors;
}

/** Limite do nome da meta de economia (SavingsGoalRules.NAME_MAX_LENGTH na API). */
export const SAVINGS_GOAL_NAME_MAX_LENGTH = 100;

export type SavingsGoalFormValues = {
  name: string;
  targetCents: number;
  icon?: string;
  color?: string;
};

export type SavingsGoalFormErrors = Partial<Record<'name' | 'target' | 'icon' | 'color', string>>;

/**
 * Espelha os validadores de meta de economia da API (nome obrigatório até 100 caracteres, valor
 * alvo > 0, ícone e cor). O prazo vem de uma lista que só oferece meses aceitos pela API.
 */
export function validateSavingsGoalForm(values: SavingsGoalFormValues): SavingsGoalFormErrors {
  const errors: SavingsGoalFormErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Informe o nome da meta.';
  else if (name.length > SAVINGS_GOAL_NAME_MAX_LENGTH)
    errors.name = `O nome deve ter no máximo ${SAVINGS_GOAL_NAME_MAX_LENGTH} caracteres.`;
  if (values.targetCents <= 0) errors.target = 'Informe um valor maior que zero.';
  if (!values.icon) errors.icon = 'Escolha um ícone.';
  if (!values.color) errors.color = 'Escolha uma cor.';
  return errors;
}

export type SavingsMovementFormErrors = Partial<Record<'amount' | 'date', string>>;

/**
 * Espelha o ValidatorSavingsMovement da API (valor > 0, data não futura). Na retirada, `maxCents`
 * é o valor guardado: a API recusa retiradas maiores que ele.
 */
export function validateSavingsMovementForm(
  values: { amountCents: number; date: string; maxCents?: number },
  today: string,
): SavingsMovementFormErrors {
  const errors: SavingsMovementFormErrors = {};
  if (values.amountCents <= 0) errors.amount = 'Informe um valor maior que zero.';
  else if (values.maxCents !== undefined && values.amountCents > values.maxCents)
    errors.amount = 'O valor é maior que o guardado na meta.';
  if (!values.date) errors.date = 'Informe a data.';
  else if (values.date > today) errors.date = 'A data não pode ser futura.';
  return errors;
}

export type ProfileFormErrors = Partial<Record<'name' | 'email', string>>;

/** Espelha o UpdateUserValidator da API (nome obrigatório, e-mail obrigatório e válido). */
export function validateProfileForm(values: { name: string; email: string }): ProfileFormErrors {
  const errors: ProfileFormErrors = {};
  if (!values.name.trim()) errors.name = 'Informe seu nome completo.';
  if (!values.email.trim()) errors.email = 'Informe seu e-mail.';
  else if (!isValidEmail(values.email)) errors.email = 'E-mail inválido.';
  return errors;
}

export type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ChangePasswordFormErrors = Partial<Record<keyof ChangePasswordFormValues, string>>;

/** Mesmo texto da API (NEW_PASSWORD_SAME_AS_CURRENT). */
export const NEW_PASSWORD_SAME_AS_CURRENT = 'A nova senha deve ser diferente da senha atual.';

/**
 * A senha atual é conferida pela API; a nova segue o mesmo PasswordValidator do cadastro e,
 * como no ChangePasswordUseCase, não pode ser idêntica à atual (texto exato, sem trim). O aviso
 * de formato tem prioridade sobre o de senha repetida.
 */
export function validateChangePasswordForm(
  values: ChangePasswordFormValues,
): ChangePasswordFormErrors {
  const errors: ChangePasswordFormErrors = {};
  if (!values.currentPassword) errors.currentPassword = 'Informe a senha atual.';
  if (!values.newPassword) errors.newPassword = 'Informe a nova senha.';
  else if (!isValidPassword(values.newPassword)) errors.newPassword = PASSWORD_REQUIREMENTS;
  else if (values.newPassword === values.currentPassword)
    errors.newPassword = NEW_PASSWORD_SAME_AS_CURRENT;
  if (!values.confirmPassword) errors.confirmPassword = 'Confirme a nova senha.';
  else if (values.confirmPassword !== values.newPassword)
    errors.confirmPassword = 'As senhas não coincidem.';
  return errors;
}

export type PasswordStrength = 'fraca' | 'média' | 'forte';

/**
 * Força exibida no formulário, contando quantas das 5 exigências da API a senha cumpre
 * (8+ caracteres, maiúscula, minúscula, número, especial). "forte" = aceita pela API.
 */
export function passwordStrength(value: string): { level: PasswordStrength; score: number } {
  const score = PASSWORD_RULES.filter((rule) => rule.test(value)).length;
  const level: PasswordStrength = score === 5 ? 'forte' : score >= 3 ? 'média' : 'fraca';
  return { level, score };
}

export type ResetPasswordFormValues = {
  newPassword: string;
  confirmPassword: string;
};

export type ResetPasswordFormErrors = Partial<Record<keyof ResetPasswordFormValues, string>>;

/** Nova senha da recuperação: o mesmo PasswordValidator do cadastro, mais a confirmação. */
export function validateResetPasswordForm(
  values: ResetPasswordFormValues,
): ResetPasswordFormErrors {
  const errors: ResetPasswordFormErrors = {};
  if (!values.newPassword) errors.newPassword = 'Informe a nova senha.';
  else if (!isValidPassword(values.newPassword)) errors.newPassword = PASSWORD_REQUIREMENTS;
  if (!values.confirmPassword) errors.confirmPassword = 'Confirme a nova senha.';
  else if (values.confirmPassword !== values.newPassword)
    errors.confirmPassword = 'As senhas não coincidem.';
  return errors;
}

/** Código da recuperação: só dígitos, com o tamanho informado pela API (PasswordResetRules). */
export function isValidResetCode(code: string, length: number): boolean {
  return code.length === length && /^\d+$/.test(code);
}
