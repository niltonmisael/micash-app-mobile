import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppLogo } from '@/components/AppLogo';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { hasBeenAwayTooLong, isAppLockEnabled } from '@/lib/appLock';
import { logout } from '@/lib/auth';
import { authenticateWithBiometrics } from '@/lib/biometrics';

type LockState = 'checking' | 'locked' | 'unlocked';

/**
 * Trava por biometria por cima de todo o app (montada em `app/_layout.tsx`). É um `Modal` para
 * cobrir também as telas e os `BottomSheet` abertos. Vale ao abrir o app por qualquer caminho
 * (ícone, link `micash://`, toque numa notificação) e ao voltar do segundo plano depois de
 * `LOCK_AFTER_BACKGROUND_MS`. Também esconde o conteúdo enquanto o app está em segundo plano,
 * para a miniatura de apps recentes não mostrar saldo e transações.
 * Trava local: não substitui a autenticação na API.
 */
export function AppLock() {
  const [state, setState] = useState<LockState>('checking');
  const [covered, setCovered] = useState(AppState.currentState !== 'active');
  const backgroundAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticateWithBiometrics('Desbloquear o MiCash')) setState('unlocked');
    } finally {
      prompting.current = false;
    }
  }, []);

  const lockIfEnabled = useCallback(
    () =>
      isAppLockEnabled().then((enabled) => {
        setState(enabled ? 'locked' : 'unlocked');
        if (enabled) void unlock();
      }),
    [unlock],
  );

  // Abertura do app, por qualquer rota.
  useEffect(() => {
    void lockIfEnabled();
  }, [lockIfEnabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      // A própria janela da biometria deixa o app "inactive" no iOS: não conta como saída.
      if (prompting.current) return;
      setCovered(next !== 'active');
      if (next === 'background') {
        backgroundAt.current ??= Date.now();
      } else if (next === 'active') {
        const away = hasBeenAwayTooLong(backgroundAt.current, Date.now());
        backgroundAt.current = null;
        if (away) void lockIfEnabled();
      }
    });
    return () => subscription.remove();
  }, [lockIfEnabled]);

  async function signInWithPassword() {
    await logout();
    setState('unlocked');
    router.replace('/login');
  }

  const visible = state !== 'unlocked' || covered;

  return (
    <Modal visible={visible} animationType="none" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.container}>
        <AppLogo size="lg" />
        <Text style={styles.title}>MiCash</Text>
        {state === 'locked' && !covered && (
          <View style={styles.locked}>
            <Text style={styles.lockedText}>O MiCash está protegido por biometria.</Text>
            <PrimaryButton title="Desbloquear" onPress={unlock} style={styles.unlockButton} />
            <Pressable onPress={signInWithPassword} hitSlop={8} accessibilityRole="button">
              <Text style={styles.passwordLink}>Entrar com e-mail e senha</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 34,
    color: colors.primary,
    marginTop: 18,
  },
  locked: {
    alignItems: 'center',
    gap: 14,
    marginTop: 28,
  },
  lockedText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  unlockButton: {
    width: 240,
  },
  passwordLink: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
  },
});
