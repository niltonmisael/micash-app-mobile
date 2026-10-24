// Contratos de MiCash.API (MiCash.Communication), serializados em camelCase pelo ASP.NET.

/** RequestLoginJson */
export type LoginRequest = {
  email: string;
  password: string;
};

/**
 * RequestRegisterUserJson. O contrato também tem `phone`, opcional e sem validação na API;
 * ele fica de fora porque a tela de cadastro não coleta telefone.
 */
export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
};

/** ResponseRegisteredUserJson — também é o que fica salvo como sessão no aparelho. */
export type Session = {
  name: string;
  token: string;
  refreshToken: string;
};
