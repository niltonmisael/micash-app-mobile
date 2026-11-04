import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppLogo } from '@/components/AppLogo';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { getSession, isSessionVerified, logout } from '@/lib/auth';
import { authenticateWithBiometrics } from '@/lib/biometrics';
import { getSettings } from '@/lib/settings';

const SPLASH_DURATION_MS = 2000;

const WAVE_PATH = 'M0 60 C30 30 50 70 80 50 S130 20 160 45 S220 70 250 30 L280 40';

export default function SplashScreen() {
  const router = useRouter();
  const [locked, setLocked] = useState(false);

  async function unlock() {
    // Trava local: a biometria só libera a sessão já salva; não substitui o login na API.
    if (await authenticateWithBiometrics('Desbloquear o MiCash')) router.replace('/home');
  }

  async function signInWithPassword() {
    await logout();
    router.replace('/login');
  }

  useEffect(() => {
    let active = true;
    const startup = Promise.all([getSession(), getSettings()]);

    // `replace` remove a Splash do histórico: o "voltar" não retorna aqui.
    const timer = setTimeout(async () => {
      const [session, settings] = await startup;
      if (!active) return;
      if (!session) router.replace('/login');
      // E-mail ainda não confirmado: a tela do código vem antes de tudo (a API bloqueia o resto).
      else if (!isSessionVerified(session)) router.replace('/verify-email');
      else if (!settings.biometrics) router.replace('/home');
      else if (await authenticateWithBiometrics('Desbloquear o MiCash')) {
        if (active) router.replace('/home');
      } else if (active) setLocked(true);
    }, SPLASH_DURATION_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <AppLogo size="lg" />
        <Text style={styles.title} accessibilityRole="header">
          MiCash
        </Text>
        <Text style={styles.tagline}>
          {'Controle financeiro\nde forma simples\ne inteligente.'}
        </Text>
        {locked && (
          <View style={styles.locked}>
            <Text style={styles.lockedText}>O MiCash está protegido por biometria.</Text>
            <PrimaryButton title="Desbloquear" onPress={unlock} style={styles.unlockButton} />
            <Pressable onPress={signInWithPassword} hitSlop={8} accessibilityRole="button">
              <Text style={styles.passwordLink}>Entrar com e-mail e senha</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Svg
        viewBox="0 0 280 90"
        style={styles.wave}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Path d={`${WAVE_PATH} L280 90 L0 90Z`} fill={colors.beige} />
        <Path d={WAVE_PATH} fill="none" stroke={colors.beigeStroke} strokeWidth={1.5} />
      </Svg>

      <View style={styles.progressTrack}>
        <View style={styles.progressFill} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  brand: {
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 34,
    color: colors.primary,
    marginTop: 18,
    marginBottom: 10,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
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
  wave: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    width: '100%',
    aspectRatio: 280 / 90,
  },
  progressTrack: {
    position: 'absolute',
    bottom: 22,
    width: 60,
    height: 3,
    borderRadius: 3,
    backgroundColor: colors.grayLight,
  },
  progressFill: {
    width: '50%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
