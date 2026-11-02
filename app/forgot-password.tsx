import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import IconCircleCheck from '@tabler/icons-react-native/IconCircleCheck';
import IconLock from '@tabler/icons-react-native/IconLock';
import IconLockCheck from '@tabler/icons-react-native/IconLockCheck';
import IconMail from '@tabler/icons-react-native/IconMail';
import IconMailCheck from '@tabler/icons-react-native/IconMailCheck';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
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
import { PasswordStrength } from '@/components/PasswordStrength';
import { PasswordVisibilityToggle } from '@/components/PasswordVisibilityToggle';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { ApiError } from '@/lib/api';
import {
  PASSWORD_RESET_DEFAULTS,
  PASSWORD_RESET_MAX_ATTEMPTS,
  passwordResetErrorMessage,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from '@/lib/passwordReset';
import type { ForgotPasswordResponse } from '@/types/passwordReset';
import { formatCountdown, maskEmail } from '@/utils/format';
import {
  NEW_PASSWORD_SAME_AS_CURRENT,
  isValidEmail,
  isValidResetCode,
  validateResetPasswordForm,
} from '@/utils/validation';

type Step = 'email' | 'code' | 'password' | 'done';

type Icon = ComponentType<{ size?: number; color?: string }>;

/**
 * Recuperação de senha (POST /forgot-password → /verify-password-reset-code → /reset-password).
 * As etapas ficam numa rota só: o e-mail, o código e a autorização de redefinição existem apenas
 * na memória desta tela (nunca na URL nem no aparelho) e somem ao concluir ou sair.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [rules, setRules] = useState<ForgotPasswordResponse>(PASSWORD_RESET_DEFAULTS);
  /** Momento (ms) em que o reenvio do código fica disponível. */
  const [resendAt, setResendAt] = useState(0);
  /** Autorização da etapa 3 e quando ela vence (ms), calculado com o `expiresInMinutes` da API. */
  const [reset, setReset] = useState<{ token: string; expiresAt: number }>();

  function codeSent(response: ForgotPasswordResponse) {
    setRules(response);
    setResendAt(Date.now() + response.resendAvailableInSeconds * 1000);
  }

  function restart() {
    setReset(undefined);
    setStep('email');
  }

  function goToLogin() {
    router.dismissTo('/login');
  }

  // Voltar retorna uma etapa; na nova senha, o código já foi usado: sair pede confirmação.
  function back(): boolean {
    if (step === 'code') {
      setStep('email');
      return true;
    }
    if (step === 'password') {
      Alert.alert(
        'Cancelar a redefinição?',
        'Para continuar depois, será preciso um novo código.',
        [
          { text: 'Continuar aqui', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: goToLogin },
        ],
      );
      return true;
    }
    if (step === 'done') {
      goToLogin();
      return true;
    }
    router.back();
    return true;
  }

  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => backRef.current());
    return () => subscription.remove();
  }, []);

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
          {step !== 'done' && (
            <Pressable
              onPress={back}
              hitSlop={12}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <IconArrowLeft size={24} color={colors.textPrimary} />
            </Pressable>
          )}

          {step === 'email' && (
            <EmailStep
              email={email}
              onChangeEmail={setEmail}
              onSent={(response) => {
                codeSent(response);
                setStep('code');
              }}
              onBackToLogin={goToLogin}
            />
          )}
          {step === 'code' && (
            <CodeStep
              email={email}
              rules={rules}
              resendAt={resendAt}
              onResent={codeSent}
              onVerified={(token, expiresInMinutes) => {
                setReset({ token, expiresAt: Date.now() + expiresInMinutes * 60_000 });
                setStep('password');
              }}
              onChangeEmail={() => setStep('email')}
            />
          )}
          {step === 'password' && reset && (
            <PasswordStep
              resetToken={reset.token}
              expiresAt={reset.expiresAt}
              onDone={() => {
                setReset(undefined);
                setStep('done');
              }}
              onRestart={restart}
            />
          )}
          {step === 'done' && <DoneStep onBackToLogin={goToLogin} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepHeader({
  icon: StepIcon,
  title,
  subtitle,
  success,
}: {
  icon: Icon;
  title: string;
  subtitle: ReactNode;
  success?: boolean;
}) {
  return (
    <View style={styles.stepHeader}>
      <View style={[styles.iconCircle, success && styles.iconCircleSuccess]}>
        <StepIcon size={30} color={success ? colors.income : colors.primary} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

/** Etapa 1 (protótipo 04): pede o código. A resposta não revela se o e-mail tem conta. */
function EmailStep({
  email,
  onChangeEmail,
  onSent,
  onBackToLogin,
}: {
  email: string;
  onChangeEmail: (email: string) => void;
  onSent: (response: ForgotPasswordResponse) => void;
  onBackToLogin: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const emailError = !email.trim()
    ? 'Informe seu e-mail.'
    : !isValidEmail(email)
      ? 'E-mail inválido.'
      : undefined;

  async function handleSubmit() {
    if (submitting) return;
    setTouched(true);
    if (emailError) return;
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      onSent(await requestPasswordReset(email));
    } catch (error) {
      setSubmitError(passwordResetErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <>
      <StepHeader
        icon={IconMailCheck}
        title="Recuperar senha"
        subtitle="Digite seu e-mail e enviaremos um código para redefinir sua senha."
      />
      <TextField
        label="E-mail"
        hideLabel
        icon={IconMail}
        value={email}
        onChangeText={onChangeEmail}
        onBlur={() => setTouched(true)}
        onSubmitEditing={handleSubmit}
        error={touched ? emailError : undefined}
        editable={!submitting}
        placeholder="E-mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        autoFocus={!email}
      />
      <View style={styles.action}>
        <ErrorText message={submitError} />
        <PrimaryButton title="Obter código" onPress={handleSubmit} loading={submitting} />
      </View>
      <View style={styles.spacer} />
      <Pressable onPress={onBackToLogin} hitSlop={8} accessibilityRole="link">
        <Text style={styles.footerLink}>Voltar para o login</Text>
      </Pressable>
    </>
  );
}

/** Etapa 2: código de 6 dígitos, com reenvio liberado depois do intervalo da API. */
function CodeStep({
  email,
  rules,
  resendAt,
  onResent,
  onVerified,
  onChangeEmail,
}: {
  email: string;
  rules: ForgotPasswordResponse;
  resendAt: number;
  onResent: (response: ForgotPasswordResponse) => void;
  onVerified: (resetToken: string, expiresInMinutes: number) => void;
  onChangeEmail: () => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  // A API invalida o código depois de 5 tentativas, com a mesma mensagem de código errado.
  const [attempts, setAttempts] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const attemptsExhausted = attempts >= PASSWORD_RESET_MAX_ATTEMPTS;
  const complete = isValidResetCode(code, rules.codeLength);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function verify(value = code) {
    if (verifying || attemptsExhausted || !isValidResetCode(value, rules.codeLength)) return;
    setError(undefined);
    setNotice(undefined);
    setVerifying(true);
    try {
      const { resetToken, expiresInMinutes } = await verifyPasswordResetCode(email, value);
      onVerified(resetToken, expiresInMinutes);
    } catch (err) {
      const used = attempts + 1;
      setAttempts(used);
      setError(
        used >= PASSWORD_RESET_MAX_ATTEMPTS
          ? 'Você usou todas as tentativas deste código. Solicite um novo código.'
          : passwordResetErrorMessage(err),
      );
      setCode('');
      setVerifying(false);
      inputRef.current?.focus();
    }
  }

  async function resend() {
    if (resending || secondsLeft > 0) return;
    setError(undefined);
    setNotice(undefined);
    setResending(true);
    try {
      onResent(await requestPasswordReset(email));
      setNow(Date.now());
      setAttempts(0);
      setCode('');
      setNotice('Enviamos um novo código. O anterior deixou de valer.');
      inputRef.current?.focus();
    } catch (err) {
      setError(passwordResetErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <StepHeader
        icon={IconMailCheck}
        title="Verifique seu e-mail"
        subtitle={
          <>
            Se houver uma conta com <Text style={styles.subtitleStrong}>{maskEmail(email)}</Text>,
            enviamos um código de {rules.codeLength} dígitos. Ele expira em{' '}
            {rules.codeExpiresInMinutes} minutos.
          </>
        }
      />

      <CodeInput
        ref={inputRef}
        length={rules.codeLength}
        value={code}
        onChange={(value) => {
          setCode(value);
          if (error && !attemptsExhausted) setError(undefined);
        }}
        onComplete={(value) => verify(value)}
        error={!!error}
        disabled={verifying || attemptsExhausted}
        autoFocus
      />
      <View style={styles.codeMessages}>
        <ErrorText message={error} />
        {!!notice && !error && (
          <Text style={styles.notice} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        )}
      </View>

      <PrimaryButton
        title="Confirmar"
        onPress={() => verify()}
        loading={verifying}
        disabled={!complete || attemptsExhausted}
      />

      <View style={styles.resend}>
        {secondsLeft > 0 ? (
          <Text style={styles.resendWait} accessibilityLiveRegion="polite">
            Reenviar código em {formatCountdown(secondsLeft)}
          </Text>
        ) : (
          <Pressable
            onPress={resend}
            disabled={resending}
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

      <View style={styles.spacer} />
      <Pressable onPress={onChangeEmail} hitSlop={8} accessibilityRole="link">
        <Text style={styles.footerLink}>Alterar e-mail</Text>
      </Pressable>
    </>
  );
}

/** Etapa 3 (padrão do protótipo 23): nova senha com as regras do PasswordValidator da API. */
function PasswordStep({
  resetToken,
  expiresAt,
  onDone,
  onRestart,
}: {
  resetToken: string;
  expiresAt: number;
  onDone: () => void;
  onRestart: () => void;
}) {
  const [values, setValues] = useState({ newPassword: '', confirmPassword: '' });
  const [visible, setVisible] = useState({ newPassword: false, confirmPassword: false });
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [expired, setExpired] = useState(false);

  const errors = validateResetPasswordForm(values);
  // A confirmação diferente aparece assim que é digitada, sem esperar o envio.
  const confirmError =
    showErrors || (values.confirmPassword && values.confirmPassword !== values.newPassword)
      ? errors.confirmPassword
      : undefined;

  async function handleSubmit() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await resetPassword(resetToken, values.newPassword);
      onDone();
    } catch (error) {
      // Senha igual à atual não consome a autorização: dá para tentar outra senha aqui mesmo.
      // Com a autorização vencida (pelo relógio ou porque a API a recusou), só um código novo.
      const message = passwordResetErrorMessage(error);
      const refused =
        error instanceof ApiError &&
        error.status === 400 &&
        message !== NEW_PASSWORD_SAME_AS_CURRENT;
      setExpired(Date.now() >= expiresAt || refused);
      setSubmitError(message);
      setSubmitting(false);
    }
  }

  function field(name: 'newPassword' | 'confirmPassword', label: string, error?: string) {
    return (
      <TextField
        label={label}
        icon={IconLock}
        value={values[name]}
        onChangeText={(text) => setValues((current) => ({ ...current, [name]: text }))}
        error={error}
        placeholder="••••••••"
        secureTextEntry={!visible[name]}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        editable={!submitting}
        accessory={
          <PasswordVisibilityToggle
            visible={visible[name]}
            onToggle={() => setVisible((current) => ({ ...current, [name]: !current[name] }))}
          />
        }
      />
    );
  }

  return (
    <>
      <StepHeader
        icon={IconLockCheck}
        title="Criar nova senha"
        subtitle="Código confirmado. Escolha a nova senha da sua conta."
      />
      <View style={styles.fields}>
        <View>
          {field('newPassword', 'Nova senha', showErrors ? errors.newPassword : undefined)}
          <PasswordStrength password={values.newPassword} showRules />
        </View>
        {field('confirmPassword', 'Confirmar nova senha', confirmError)}
      </View>

      <View style={styles.spacer} />

      {!!submitError && (
        <View style={styles.submitErrorBox}>
          <ErrorText message={submitError} />
          {expired && (
            <Pressable onPress={onRestart} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>Solicitar novo código</Text>
            </Pressable>
          )}
        </View>
      )}
      <PrimaryButton title="Redefinir senha" onPress={handleSubmit} loading={submitting} />
    </>
  );
}

/** Concluído: o app não entra sozinho; o usuário faz login com a nova senha. */
function DoneStep({ onBackToLogin }: { onBackToLogin: () => void }) {
  return (
    <>
      <View style={styles.doneTop} />
      <StepHeader
        icon={IconCircleCheck}
        success
        title="Senha alterada"
        subtitle="Sua senha foi redefinida. Entre no MiCash com a nova senha."
      />
      <View style={styles.spacer} />
      <PrimaryButton title="Voltar para o login" onPress={onBackToLogin} />
    </>
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
  back: {
    alignSelf: 'flex-start',
    marginBottom: 30,
  },
  stepHeader: {
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
  iconCircleSuccess: {
    backgroundColor: colors.incomeSoft,
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
  action: {
    marginTop: 20,
  },
  fields: {
    gap: 18,
  },
  codeMessages: {
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
  submitErrorBox: {
    marginBottom: 12,
  },
  spacer: {
    flex: 1,
    minHeight: 28,
  },
  footerLink: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
  },
  doneTop: {
    height: 40,
  },
});
