// Contratos de MiCash.API (MiCash.Communication), serializados em camelCase pelo ASP.NET.

/** RequestLoginJson */
export type LoginRequest = {
  email: string;
  password: string;
};

/**
 * RequestRegisterUserJson. A API não valida `phone` (só grava, até 20 caracteres); o app envia
 * só os dígitos do celular (DDD + número, ex.: "11987654321"), no mesmo formato da web.
 */
export type RegisterRequest = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

/**
 * ResponseRegisteredUserJson (login, cadastro, refresh) — também é o que fica salvo como sessão
 * no aparelho. Com `emailVerified: false`, a API responde 403 `EMAIL_NOT_VERIFIED` em tudo, exceto
 * nas rotas da verificação: o app abre a tela do código. Sessões salvas antes desse campo existir
 * não o têm e contam como verificadas (a API marcou essas contas como confirmadas).
 */
export type Session = {
  name: string;
  token: string;
  refreshToken: string;
  emailVerified?: boolean;
};
