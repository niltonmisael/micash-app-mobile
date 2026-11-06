import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

/**
 * Tempo em segundo plano depois do qual o app volta a pedir a biometria. Uma troca rápida de app
 * (copiar um código, atender uma notificação) não trava; sair e voltar depois, sim.
 */
export const LOCK_AFTER_BACKGROUND_MS = 30_000;

/** A trava vale quando há sessão salva e o usuário ligou a biometria em Configurações. */
export async function isAppLockEnabled(): Promise<boolean> {
  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  return session !== null && settings.biometrics;
}

/** O app ficou tempo demais em segundo plano (`backgroundAt` = quando saiu; `null` = não saiu). */
export function hasBeenAwayTooLong(backgroundAt: number | null, now: number): boolean {
  return backgroundAt !== null && now - backgroundAt >= LOCK_AFTER_BACKGROUND_MS;
}
