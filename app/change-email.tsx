import IconLock from '@tabler/icons-react-native/IconLock';
import IconMail from '@tabler/icons-react-native/IconMail';
import IconMailCheck from '@tabler/icons-react-native/IconMailCheck';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import type { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CodeInput } from '@/components/CodeInput';
import { PasswordVisibilityToggle } from '@/components/PasswordVisibilityToggle';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { ApiError } from '@/lib/api';
import {
  EMAIL_CODE_DEFAULTS,
  EMAIL_CODE_MAX_ATTEMPTS,
  confirmEmailChange,
  emailCodeErrorMessage,
  requestEmailChange,
  resendAvailableAt,
} from '@/lib/emailVerification';
import type { EmailCodeSentResponse } from '@/types/emailVerification';
import { formatCountdown, maskEmail } from '@/utils/format';
import { isValidEmail, isValidResetCode } from '@/utils/validation';

type Step = 'form' | 'code';

/**
 * Troca do e-mail de uma conta verificada, em duas etapas (POST /api/user/email-change →
 * /api/user/email-change/confirm). A conta continua com o e-mail atual até o código chegar ao novo
 * endereço e ser digitado aqui; o endereço anterior recebe um aviso. A senha só fica na memória
 * desta tela (para reenviar o código) e some ao sair.
 */
export default function ChangeEmailScreen() {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const inputRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>('form');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const [rules, setRules] = useState<Omit<EmailCodeSentResponse, 'email'>>(EMAIL_CODE_DEFAULTS);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const [code, setCode] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const attemptsExhausted = attempts >= EMAIL_CODE_MAX_ATTEMPTS;
  const busy = sending || confirming;

  const emailError = !newEmail.trim()
    ? 'Informe o novo e-mail.'
    : !isValidEmail(newEmail)
      ? 'E-mail inválido.'
      : undefined;
  const passwordError = !password ? 'Informe sua senha atual.' : undefined;

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  /** Envia (ou reenvia) o código para o novo e-mail. */
  async function sendCode(): Promise<boolean> {
    setError(undefined);
    setNotice(undefined);
    setSending(true);
    try {
      const response = await runAuthenticated((token) =>
        requestEmailChange(token, newEmail, password),
      );
      setRules(response);
      setResendAt(resendAvailableAt(response));
      setNow(Date.now());
      setAttempts(0);
      setCode('');
      return true;
    } catch (err) {
      if (err instanceof HandledActionError) return false;
      if (err instanceof ApiError && err.status === 429) {
        setResendAt(resendAvailableAt({ retryAt: err.retryAt }));
        setNow(Date.now());
      }
      setError(emailCodeErrorMessage(err));
      return false;
    } finally {
      setSending(false);
    }
  }

  async function submitForm() {
    if (busy) return;
    setTouched(true);
    if (emailError || passwordError) return;
    if (await sendCode()) setStep('code');
  }

  async function resend() {
    if (busy || secondsLeft > 0) return;
    if (await sendCode()) {
      setNotice('Enviamos um novo código. O anterior deixou de valer.');
      inputRef.current?.focus();
    }
  }

  async function confirm(value = code) {
    if (busy || attemptsExhausted || !isValidResetCode(value, rules.codeLength)) return;
    setError(undefined);
    setNotice(undefined);
    setConfirming(true);
    try {
      const profile = await runAuthenticated((token) => confirmEmailChange(token, value));
      setPassword('');
      router.back();
      Alert.alert('E-mail alterado', `Use ${profile.email} para entrar na próxima vez.`);
    } catch (err) {
      if (err instanceof HandledActionError) return;
      const used = attempts + 1;
      setAttempts(used);
      setError(
        used >= EMAIL_CODE_MAX_ATTEMPTS
          ? 'Você usou todas as tentativas deste código. Solicite um novo código.'
          : emailCodeErrorMessage(err),
      );
      setCode('');
      setConfirming(false);
      inputRef.current?.focus();
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Alterar e-mail" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <IconMailCheck size={30} color={colors.primary} />
            </View>
            <Text style={styles.subtitle}>
              {step === 'form' ? (
                'Informe o novo e-mail e sua senha atual. Enviaremos um código para o novo endereço; até você confirmar, sua conta continua com o e-mail atual.'
              ) : (
                <>
                  Enviamos um código de {rules.codeLength} dígitos para{' '}
                  <Text style={styles.subtitleStrong}>{maskEmail(newEmail)}</Text>. Ele expira em{' '}
                  {rules.codeExpiresInMinutes} minutos.
                </>
              )}
            </Text>
          </View>

          {step === 'form' ? (
            <>
              <View style={styles.fields}>
                <TextField
                  label="Novo e-mail"
                  icon={IconMail}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  error={touched ? emailError : undefined}
                  editable={!sending}
                  maxLength={255}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  autoFocus
                />
                <TextField
                  label="Senha atual"
                  icon={IconLock}
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={submitForm}
                  error={touched ? passwordError : undefined}
                  editable={!sending}
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="send"
                  accessory={
                    <PasswordVisibilityToggle
                      visible={passwordVisible}
                      onToggle={() => setPasswordVisible((visible) => !visible)}
                    />
                  }
                />
              </View>
              <View style={styles.action}>
                {!!error && (
                  <Text style={styles.error} accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                )}
                <PrimaryButton title="Enviar código" onPress={submitForm} loading={sending} />
              </View>
            </>
          ) : (
            <>
              <CodeInput
                ref={inputRef}
                length={rules.codeLength}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error && !attemptsExhausted) setError(undefined);
                }}
                onComplete={(value) => confirm(value)}
                error={!!error}
                disabled={confirming || attemptsExhausted}
                autoFocus
              />
              <View style={styles.messages}>
                {!!error && (
                  <Text style={styles.error} accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                )}
                {!!notice && !error && (
                  <Text style={styles.notice} accessibilityLiveRegion="polite">
                    {notice}
                  </Text>
                )}
              </View>

              <PrimaryButton
                title="Confirmar novo e-mail"
                onPress={() => confirm()}
                loading={confirming}
                disabled={!isValidResetCode(code, rules.codeLength) || attemptsExhausted || busy}
              />

              <View style={styles.resend}>
                {secondsLeft > 0 ? (
                  <Text style={styles.resendWait} accessibilityLiveRegion="polite">
                    Reenviar código em {formatCountdown(secondsLeft)}
                  </Text>
                ) : (
                  <Pressable
                    onPress={resend}
                    disabled={busy}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.link, sending && styles.linkDisabled]}>
                      {sending ? 'Reenviando…' : 'Reenviar código'}
                    </Text>
                  </Pressable>
                )}
                <Text style={styles.hint}>Não recebeu? Confira também a caixa de spam.</Text>
              </View>

              <Pressable
                style={styles.otherEmail}
                onPress={() => {
                  setError(undefined);
                  setNotice(undefined);
                  setStep('form');
                }}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.link}>Usar outro e-mail</Text>
              </Pressable>
            </>
          )}
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subtitleStrong: {
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  fields: {
    gap: 18,
  },
  action: {
    marginTop: 24,
  },
  messages: {
    minHeight: 24,
    marginTop: 12,
    marginBottom: 12,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.expense,
    textAlign: 'center',
    marginBottom: 12,
  },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.income,
    textAlign: 'center',
  },
  resend: {
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  resendWait: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  link: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
  },
  linkDisabled: {
    opacity: 0.6,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  otherEmail: {
    alignSelf: 'center',
    marginTop: 24,
  },
});
