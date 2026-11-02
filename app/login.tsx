import IconBrandApple from '@tabler/icons-react-native/IconBrandApple';
import IconBrandGoogle from '@tabler/icons-react-native/IconBrandGoogle';
import IconLock from '@tabler/icons-react-native/IconLock';
import IconMail from '@tabler/icons-react-native/IconMail';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/AppLogo';
import { PasswordVisibilityToggle } from '@/components/PasswordVisibilityToggle';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { ApiError } from '@/lib/api';
import { login } from '@/lib/auth';
import { isValidEmail } from '@/utils/validation';

// Login social ainda não existe; o aviso deixa isso explícito.
function showComingSoon(feature: string) {
  Alert.alert('Em breve', `${feature} estará disponível em uma próxima versão.`);
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const emailValid = isValidEmail(email);
  const emailError =
    emailTouched && email.length > 0 && !emailValid ? 'E-mail inválido' : undefined;
  const canSubmit = emailValid && password.length > 0 && !submitting;

  async function handleSubmit() {
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.replace('/home');
    } catch (error) {
      setSubmitError(
        error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppLogo size="md" />
          <Text style={styles.title} accessibilityRole="header">
            Bem-vindo!
          </Text>
          <Text style={styles.subtitle}>Faça login para continuar</Text>

          <TextField
            label="E-mail"
            icon={IconMail}
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            error={emailError}
            editable={!submitting}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <View style={styles.passwordField}>
            <TextField
              label="Senha"
              icon={IconLock}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => canSubmit && handleSubmit()}
              editable={!submitting}
              placeholder="••••••••"
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              accessory={
                <PasswordVisibilityToggle
                  visible={passwordVisible}
                  onToggle={() => setPasswordVisible((visible) => !visible)}
                />
              }
            />
          </View>

          <Pressable
            style={styles.forgotPassword}
            onPress={() => router.push('/forgot-password')}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={styles.link}>Esqueceu sua senha?</Text>
          </Pressable>

          {!!submitError && (
            <Text style={styles.submitError} accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          )}

          <PrimaryButton
            title="Entrar"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            style={styles.primaryButton}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou entre com</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <Pressable
              style={({ pressed }) => [styles.socialButton, pressed && styles.socialButtonPressed]}
              onPress={() => showComingSoon('O login com Google')}
              accessibilityRole="button"
              accessibilityLabel="Entrar com Google"
            >
              <IconBrandGoogle size={22} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.socialButton, pressed && styles.socialButtonPressed]}
              onPress={() => showComingSoon('O login com Apple')}
              accessibilityRole="button"
              accessibilityLabel="Entrar com Apple"
            >
              <IconBrandApple size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.spacer} />

          <Text style={styles.footer}>
            Não tem uma conta?{' '}
            <Text
              style={styles.footerLink}
              onPress={() => router.push('/register')}
              accessibilityRole="link"
            >
              Criar conta
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  passwordField: {
    marginTop: 20,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 12,
    marginBottom: 28,
  },
  link: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
  },
  primaryButton: {
    marginBottom: 28,
  },
  submitError: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.expense,
    textAlign: 'center',
    marginBottom: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonPressed: {
    backgroundColor: colors.grayLight,
  },
  spacer: {
    flex: 1,
    minHeight: 32,
  },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
});
