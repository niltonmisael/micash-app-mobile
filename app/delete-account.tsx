import IconLock from '@tabler/icons-react-native/IconLock';
import { useRouter } from 'expo-router';
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
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import { clearSession } from '@/lib/auth';
import { forgetPushDevice } from '@/lib/notifications';
import { getCurrentSubscription, isFreePlan, premiumAccessUntil } from '@/lib/subscription';
import { deleteAccount } from '@/lib/user';
import { formatDate, toDateKey } from '@/utils/format';

/**
 * Exclusão da conta (exigida pela Apple e pelo Google para apps que criam conta). Pede a senha atual;
 * quem é Premium é avisado de que a assinatura é cancelada na hora e o período restante se perde.
 * Depois da exclusão não há o que revogar na API: só apaga a sessão e o push deste aparelho.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const { data: subscription } = useAuthenticatedQuery(getCurrentSubscription);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const premium =
    subscription && !isFreePlan(subscription) && subscription.isPremium ? subscription : undefined;
  const accessUntil = premium ? premiumAccessUntil(premium) : null;

  async function remove() {
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await runAuthenticated((token) => deleteAccount(token, password));
      await forgetPushDevice();
      await clearSession();
      router.replace('/login');
      Alert.alert('Conta excluída', 'Sua conta e todos os seus dados foram apagados.');
    } catch (err) {
      if (err instanceof HandledActionError) return;
      setSubmitError(
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  function confirm() {
    if (submitting || !password) return;
    Alert.alert(
      'Excluir conta?',
      'Todos os seus dados serão apagados. Isso não pode ser desfeito.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => void remove() },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Excluir conta" />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.text}>
            Sua conta e todos os seus dados (transações, categorias, metas e conversas com a MI)
            serão apagados definitivamente. Essa ação não pode ser desfeita.
          </Text>

          {premium && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                Sua assinatura Premium será cancelada agora, sem novas cobranças.
                {accessUntil
                  ? ` O acesso que iria até ${formatDate(toDateKey(accessUntil))} será perdido, sem reembolso.`
                  : ' O período restante será perdido, sem reembolso.'}
              </Text>
            </View>
          )}

          <TextField
            label="Para confirmar, digite sua senha"
            icon={IconLock}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            editable={!submitting}
            accessory={
              <PasswordVisibilityToggle visible={visible} onToggle={() => setVisible((v) => !v)} />
            }
          />

          <View style={styles.spacer} />

          {!!submitError && (
            <Text style={styles.submitError} accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          )}
          <PrimaryButton
            title="Excluir minha conta"
            onPress={confirm}
            loading={submitting}
            disabled={!password}
            style={styles.deleteButton}
          />
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
    gap: 18,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  notice: {
    backgroundColor: colors.cream,
    borderRadius: 14,
    padding: 14,
  },
  noticeText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  spacer: {
    flex: 1,
    minHeight: 10,
  },
  submitError: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.expense,
    textAlign: 'center',
  },
  deleteButton: {
    backgroundColor: colors.expense,
  },
});
