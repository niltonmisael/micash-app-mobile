import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricAvailability = 'available' | 'no-hardware' | 'not-enrolled';

/** Se o aparelho tem leitor biométrico e alguma digital/rosto cadastrado. */
export async function getBiometricAvailability(): Promise<BiometricAvailability> {
  if (!(await LocalAuthentication.hasHardwareAsync())) return 'no-hardware';
  if (!(await LocalAuthentication.isEnrolledAsync())) return 'not-enrolled';
  return 'available';
}

/**
 * Pede a biometria do aparelho. É uma trava local do app: não substitui a autenticação
 * no backend (o acesso à API continua dependendo do token da sessão).
 */
export async function authenticateWithBiometrics(promptMessage: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    fallbackLabel: 'Usar senha do aparelho',
  });
  return result.success;
}
