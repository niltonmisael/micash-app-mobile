import * as SecureStore from 'expo-secure-store';

// Configurações locais do aparelho (a API não tem preferências do usuário).
const SETTINGS_KEY = 'micash.settings';

export type AppSettings = {
  /** Dashboard abre com o saldo visível (true) ou oculto (false). */
  showBalance: boolean;
  /** Pede biometria ao abrir o app quando há sessão salva. */
  biometrics: boolean;
};

const DEFAULT_SETTINGS: AppSettings = { showBalance: true, biometrics: false };

export async function getSettings(): Promise<AppSettings> {
  try {
    const stored = await SecureStore.getItemAsync(SETTINGS_KEY);
    return stored
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(stored) as Partial<AppSettings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(changes: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await getSettings()), ...changes };
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
