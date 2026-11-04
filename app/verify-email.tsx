import IconMail from '@tabler/icons-react-native/IconMail';
import IconMailCheck from '@tabler/icons-react-native/IconMailCheck';
import IconPencil from '@tabler/icons-react-native/IconPencil';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import { logout, refreshSession } from '@/lib/auth';
import {
  EMAIL_CODE_DEFAULTS,
  EMAIL_CODE_MAX_ATTEMPTS,
  changeVerificationEmail,
  emailCodeErrorMessage,
  resendAvailableAt,
  resendEmailVerificationCode,
  verifyEmail,
} from '@/lib/emailVerification';
import { getProfile } from '@/lib/user';
import { formatCountdown, maskEmail } from '@/utils/format';
import { isValidEmail, isValidResetCode } from '@/utils/validation';

type Mode = 'code' | 'edit-email';

/**
 * Confirmação do e-mail do cadastro. A conta já existe e está logada, mas a API responde 403
 * `EMAIL_NOT_VERIFIED` a tudo, exceto a esta tela, até o código de 6 dígitos ser digitado.
 * Aqui também dá para reenviar o código, corrigir um e-mail digitado errado e sair da conta.
 * `?from=register` começa a contagem do reenvio (o cadastro acabou de enviar um código).
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const runAuthenticated = useAuthenticatedAction();
  const { data: profile, loading, error, retry } = useAuthenticatedQuery(getProfile);
  const inputRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<Mode>('code');
  /** E-mail mostrado (o do perfil, ou o corrigido nesta tela). */
  const [email, setEmail] = useState<string>();
  const [codeLength, setCodeLength] = useState<number>(EMAIL_CODE_DEFAULTS.codeLength);
  const [expiresInMinutes, setExpiresInMinutes] = useState<number>(
    EMAIL_CODE_DEFAULTS.codeExpiresInMinutes,
  );
  const [resendAt, setResendAt] = useState(() =>
    from === 'register' ? resendAvailableAt(EMAIL_CODE_DEFAULTS) : 0,
  );
  const [now, setNow] = useState(() => Date.now());

  const [code, setCode] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [codeError, setCodeError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const [newEmail, setNewEmail] = useState('');
  const [newEmailTouched, setNewEmailTouched] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [changeError, setChangeError] = useState<string>();

  const shownEmail = email ?? profile?.email;
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const attemptsExhausted = attempts >= EMAIL_CODE_MAX_ATTEMPTS;
  const complete = isValidResetCode(code, codeLength);
  const busy = verifying || resending || changingEmail || signingOut;

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  // Confirmado por outro caminho (ex.: redefiniu a senha com o código do e-mail): renova a sessão
  // para receber um token "verificado" e segue para o app.
  useEffect(() => {
    if (!profile?.emailVerified) return;
    refreshSession()
      .catch(() => null)
      .then((session) => router.replace(session ? '/home' : '/login'));
  }, [profile?.emailVerified, router]);

  // Voltar não sai desta tela (o resto do app está bloqueado): na edição, volta ao código.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modeRef.current === 'edit-email') setMode('code');
      return true;
    });
    return () => subscription.remove();
  }, []);

  function codeSent(response: {
    email: string;
    resendAvailableInSeconds: number;
    codeExpiresInMinutes: number;
    codeLength: number;
  }) {
    setEmail(response.email);
    setCodeLength(response.codeLength);
    setExpiresInMinutes(response.codeExpiresInMinutes);
    setResendAt(resendAvailableAt(response));
    setNow(Date.now());
    setAttempts(0);
    setCode('');
  }

  /** 429 do reenvio: a contagem passa a seguir o `retryAt` da API. */
  function rateLimited(err: unknown): boolean {
    if (err instanceof ApiError && err.status === 429) {
      setResendAt(resendAvailableAt({ retryAt: err.retryAt }));
      setNow(Date.now());
      return true;
    }
    return false;
  }

  async function verify(value = code) {
    if (busy || attemptsExhausted || !isValidResetCode(value, codeLength)) return;
    setCodeError(undefined);
    setNotice(undefined);
    setVerifying(true);
    try {
      const session = await runAuthenticated((token) => verifyEmail(token, value));
      // A API já enviou o e-mail de boas-vindas. O app não oferece planos (venda só pelo site).
      router.replace('/home');
      Alert.alert(
        'E-mail confirmado',
        `Tudo pronto, ${session.name.split(' ')[0]}! Bem-vindo ao MiCash.`,
      );
    } catch (err) {
      if (err instanceof HandledActionError) return;
      const used = attempts + 1;
      setAttempts(used);
      setCodeError(
        used >= EMAIL_CODE_MAX_ATTEMPTS
          ? 'Você usou todas as tentativas deste código. Solicite um novo código.'
          : emailCodeErrorMessage(err),
      );
      setCode('');
      setVerifying(false);
      inputRef.current?.focus();
    }
  }

  async function resend() {
    if (busy || secondsLeft > 0) return;
    setCodeError(undefined);
    setNotice(undefined);
    setResending(true);
    try {
      codeSent(await runAuthenticated((token) => resendEmailVerificationCode(token)));
      setNotice('Enviamos um novo código. O anterior deixou de valer.');
      inputRef.current?.focus();
    } catch (err) {
      if (err instanceof HandledActionError) return;
      rateLimited(err);
      setCodeError(emailCodeErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  const newEmailError = !newEmail.trim()
    ? 'Informe o e-mail correto.'
    : !isValidEmail(newEmail)
      ? 'E-mail inválido.'
      : undefined;

  async function submitNewEmail() {
    if (busy) return;
    setNewEmailTouched(true);
    if (newEmailError) return;
    setChangeError(undefined);
    setChangingEmail(true);
    try {
      codeSent(await runAuthenticated((token) => changeVerificationEmail(token, newEmail)));
      setCodeError(undefined);
      setNotice('E-mail corrigido. Enviamos um novo código para o endereço novo.');
      setMode('code');
    } catch (err) {
      if (err instanceof HandledActionError) return;
      rateLimited(err);
      setChangeError(emailCodeErrorMessage(err));
    } finally {
      setChangingEmail(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sair da conta?', 'Para continuar depois, entre com seu e-mail e senha.', [
      { text: 'Continuar aqui', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          {error ? (
            <ErrorNotice message={error} onRetry={retry} retrying={loading} />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </SafeAreaView>
    );
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
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <IconMailCheck size={30} color={colors.primary} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {mode === 'code' ? 'Confirme seu e-mail' : 'Corrigir e-mail'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'code' ? (
                <>
                  Enviamos um código de {codeLength} dígitos para{' '}
                  <Text style={styles.subtitleStrong}>{maskEmail(shownEmail ?? '')}</Text>. Ele
                  expira em {expiresInMinutes} minutos.
                </>
              ) : (
                'Digite o e-mail certo. Enviaremos um novo código para ele.'
              )}
            </Text>
          </View>

          {mode === 'code' ? (
            <>
              <CodeInput
                ref={inputRef}
                length={codeLength}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (codeError && !attemptsExhausted) setCodeError(undefined);
                }}
                onComplete={(value) => verify(value)}
                error={!!codeError}
                disabled={verifying || attemptsExhausted}
                autoFocus
              />
              <View style={styles.messages}>
                {!!codeError && (
                  <Text style={styles.error} accessibilityLiveRegion="polite">
                    {codeError}
                  </Text>
                )}
                {!!notice && !codeError && (
                  <Text style={styles.notice} accessibilityLiveRegion="polite">
                    {notice}
                  </Text>
                )}
              </View>

              <PrimaryButton
                title="Confirmar"
                onPress={() => verify()}
                loading={verifying}
                disabled={!complete || attemptsExhausted || busy}
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
                    accessibilityState={{ busy: resending }}
                  >
                    <Text style={[styles.link, resending && styles.linkDisabled]}>
                      {resending ? 'Reenviando…' : 'Reenviar código'}
                    </Text>
                  </Pressable>
                )}
                <Text style={styles.hint}>Não recebeu? Confira também a caixa de spam.</Text>
              </View>

              <Pressable
                style={styles.editEmail}
                onPress={() => {
                  setNewEmail(shownEmail ?? '');
                  setNewEmailTouched(false);
                  setChangeError(undefined);
                  setMode('edit-email');
                }}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
              >
                <IconPencil size={16} color={colors.primary} />
                <Text style={styles.link}>Digitei o e-mail errado</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextField
                label="E-mail"
                hideLabel
                icon={IconMail}
                value={newEmail}
                onChangeText={setNewEmail}
                onBlur={() => setNewEmailTouched(true)}
                onSubmitEditing={submitNewEmail}
                error={newEmailTouched ? newEmailError : undefined}
                editable={!changingEmail}
                placeholder="E-mail"
                maxLength={255}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="send"
                autoFocus
              />
              <View style={styles.action}>
                {!!changeError && (
                  <Text style={styles.error} accessibilityLiveRegion="polite">
                    {changeError}
                  </Text>
                )}
                <PrimaryButton
                  title="Enviar novo código"
                  onPress={submitNewEmail}
                  loading={changingEmail}
                  disabled={busy}
                />
              </View>
              <Pressable
                style={styles.cancelEdit}
                onPress={() => setMode('code')}
                disabled={changingEmail}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.link}>Voltar para o código</Text>
              </Pressable>
            </>
          )}

          <View style={styles.spacer} />

          <Pressable
            onPress={confirmSignOut}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.signOut}>{signingOut ? 'Saindo…' : 'Sair da conta'}</Text>
          </Pressable>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
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
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
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
  action: {
    marginTop: 20,
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
  editEmail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  cancelEdit: {
    alignSelf: 'center',
    marginTop: 18,
  },
  spacer: {
    flex: 1,
    minHeight: 28,
  },
  signOut: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
