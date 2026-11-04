import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import IconDeviceMobile from '@tabler/icons-react-native/IconDeviceMobile';
import IconLock from '@tabler/icons-react-native/IconLock';
import IconMail from '@tabler/icons-react-native/IconMail';
import IconUser from '@tabler/icons-react-native/IconUser';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordVisibilityToggle } from '@/components/PasswordVisibilityToggle';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { ApiError } from '@/lib/api';
import { register } from '@/lib/auth';
import { formatPhone, phoneDigits } from '@/utils/format';
import { validateRegisterForm } from '@/utils/validation';
import type { RegisterFormValues } from '@/utils/validation';

type Field = keyof RegisterFormValues;

const INITIAL_VALUES: RegisterFormValues = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterScreen() {
  const router = useRouter();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const errors = validateRegisterForm(values);
  const fieldError = (field: Field) => (touched[field] ? errors[field] : undefined);

  function setField(field: Field) {
    return (text: string) => setValues((current) => ({ ...current, [field]: text }));
  }

  function touch(field: Field) {
    return () => setTouched((current) => ({ ...current, [field]: true }));
  }

  // Volta ao Login se ele estiver na pilha; senão, abre o Login no lugar do cadastro.
  function goToLogin() {
    router.dismissTo('/login');
  }

  async function handleSubmit() {
    if (submitting) return;

    setTouched({ name: true, email: true, phone: true, password: true, confirmPassword: true });
    if (Object.keys(errors).length > 0) return;

    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await register({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone,
        password: values.password,
      });
      // A conta nasce sem o e-mail confirmado: a API já enviou o código e só libera o app depois
      // dele. Limpa a pilha (Login/Cadastro) e abre a tela do código.
      router.dismissAll();
      router.replace({ pathname: '/verify-email', params: { from: 'register' } });
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
          <Pressable
            style={styles.backButton}
            onPress={goToLogin}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <IconArrowLeft size={24} color={colors.textPrimary} />
          </Pressable>

          <Text style={styles.title} accessibilityRole="header">
            Crie sua conta
          </Text>
          <Text style={styles.subtitle}>Preencha suas informações</Text>

          <View style={styles.fields}>
            <TextField
              label="Nome completo"
              hideLabel
              icon={IconUser}
              value={values.name}
              onChangeText={setField('name')}
              onBlur={touch('name')}
              error={fieldError('name')}
              editable={!submitting}
              placeholder="Nome completo"
              maxLength={100}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
            />

            <TextField
              label="E-mail"
              hideLabel
              icon={IconMail}
              value={values.email}
              onChangeText={setField('email')}
              onBlur={touch('email')}
              error={fieldError('email')}
              editable={!submitting}
              placeholder="E-mail"
              maxLength={255}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />

            <TextField
              label="Celular"
              hideLabel
              icon={IconDeviceMobile}
              value={formatPhone(values.phone)}
              // Guarda só os dígitos; a máscara "(11) 98765-4321" é aplicada na exibição.
              onChangeText={(text) => setField('phone')(phoneDigits(text))}
              onBlur={touch('phone')}
              error={fieldError('phone')}
              editable={!submitting}
              placeholder="Celular com DDD"
              maxLength={20}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
            />

            <TextField
              label="Senha"
              hideLabel
              icon={IconLock}
              value={values.password}
              onChangeText={setField('password')}
              onBlur={touch('password')}
              error={fieldError('password')}
              editable={!submitting}
              placeholder="Senha"
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              accessory={
                <PasswordVisibilityToggle
                  visible={passwordVisible}
                  onToggle={() => setPasswordVisible((visible) => !visible)}
                />
              }
            />

            <TextField
              label="Confirmar senha"
              hideLabel
              icon={IconLock}
              value={values.confirmPassword}
              onChangeText={setField('confirmPassword')}
              onBlur={touch('confirmPassword')}
              onSubmitEditing={handleSubmit}
              error={fieldError('confirmPassword')}
              editable={!submitting}
              placeholder="Confirmar senha"
              secureTextEntry={!confirmVisible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              accessory={
                <PasswordVisibilityToggle
                  visible={confirmVisible}
                  onToggle={() => setConfirmVisible((visible) => !visible)}
                />
              }
            />
          </View>

          {/*
            Espaço reservado para o aceite dos Termos de Uso e da Política de Privacidade,
            que ainda não existem (nem na API). Sem checkbox para não simular um aceite.
          */}
          <View style={styles.termsPlaceholder} />

          {!!submitError && (
            <Text style={styles.submitError} accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          )}

          <PrimaryButton title="Criar conta" onPress={handleSubmit} loading={submitting} />

          <View style={styles.spacer} />

          <Text style={styles.footer}>
            Já tem uma conta?{' '}
            <Text style={styles.footerLink} onPress={goToLogin} accessibilityRole="link">
              Entrar
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
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 28,
  },
  fields: {
    gap: 14,
  },
  termsPlaceholder: {
    height: 44,
  },
  submitError: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.expense,
    textAlign: 'center',
    marginBottom: 12,
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
