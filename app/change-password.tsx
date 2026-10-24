import IconLock from '@tabler/icons-react-native/IconLock';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordVisibilityToggle } from '@/components/PasswordVisibilityToggle';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { SessionEndedError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { ApiError } from '@/lib/api';
import { changePassword } from '@/lib/user';
import { passwordStrength, validateChangePasswordForm } from '@/utils/validation';
import type { ChangePasswordFormValues } from '@/utils/validation';

type Field = keyof ChangePasswordFormValues;

const EMPTY: ChangePasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const STRENGTH_COLORS = {
  fraca: colors.expense,
  média: colors.primary,
  forte: colors.income,
};

export default function ChangePasswordScreen() {
  const runAuthenticated = useAuthenticatedAction();
  const [values, setValues] = useState(EMPTY);
  const [visible, setVisible] = useState<Record<Field, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const errors = validateChangePasswordForm(values);
  const strength = passwordStrength(values.newPassword);

  function field(name: Field, label: string, autoComplete: 'current-password' | 'new-password') {
    return (
      <TextField
        label={label}
        icon={IconLock}
        value={values[name]}
        onChangeText={(text) => setValues((current) => ({ ...current, [name]: text }))}
        error={showErrors ? errors[name] : undefined}
        placeholder="••••••••"
        secureTextEntry={!visible[name]}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={autoComplete === 'current-password' ? 'password' : 'newPassword'}
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

  async function handleSave() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;

    setSubmitError(undefined);
    setSubmitting(true);
    try {
      // A confirmação não faz parte do contrato da API; só a senha atual e a nova são enviadas.
      await runAuthenticated((token) =>
        changePassword(token, {
          password: values.currentPassword,
          newPassword: values.newPassword,
        }),
      );
      setValues(EMPTY);
      setShowErrors(false);
      Alert.alert('Senha atualizada', 'Use a nova senha na próxima vez que entrar.');
    } catch (err) {
      if (err instanceof SessionEndedError) return;
      setSubmitError(
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Alterar senha" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.fields}>
            {field('currentPassword', 'Senha atual', 'current-password')}
            <View>
              {field('newPassword', 'Nova senha', 'new-password')}
              {!!values.newPassword && (
                <View
                  style={styles.strength}
                  accessibilityLabel={`Força da senha: ${strength.level}`}
                >
                  <View style={styles.strengthBars}>
                    {[1, 2, 3].map((step) => {
                      // 3 segmentos: fraca (1), média (2), forte (3).
                      const filled =
                        step === 1 ||
                        (step === 2 && strength.level !== 'fraca') ||
                        (step === 3 && strength.level === 'forte');
                      return (
                        <View
                          key={step}
                          style={[
                            styles.strengthBar,
                            filled && { backgroundColor: STRENGTH_COLORS[strength.level] },
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.strengthText}>Força da senha: {strength.level}</Text>
                </View>
              )}
            </View>
            {field('confirmPassword', 'Confirmar nova senha', 'new-password')}
          </View>

          <View style={styles.spacer} />

          {!!submitError && (
            <Text style={styles.submitError} accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          )}
          <PrimaryButton title="Atualizar senha" onPress={handleSave} loading={submitting} />
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
  fields: {
    gap: 18,
  },
  strength: {
    marginTop: 10,
    gap: 6,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grayLight,
  },
  strengthText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  spacer: {
    flex: 1,
    minHeight: 28,
  },
  submitError: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.expense,
    textAlign: 'center',
    marginBottom: 12,
  },
});
