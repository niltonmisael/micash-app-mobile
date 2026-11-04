import IconMail from '@tabler/icons-react-native/IconMail';
import IconUser from '@tabler/icons-react-native/IconUser';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import { updateSessionName } from '@/lib/auth';
import { getProfile, updateProfile } from '@/lib/user';
import type { UserProfile } from '@/types/user';
import { validateProfileForm } from '@/utils/validation';

export default function PersonalDataScreen() {
  const { data, loading, refreshing, error, retry } = useAuthenticatedQuery(getProfile);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title="Dados pessoais" />
        {data ? (
          // `key` recria o formulário com os dados novos depois de salvar e recarregar.
          <ProfileForm key={`${data.name}|${data.email}`} profile={data} />
        ) : (
          <View style={styles.content}>
            {error ? (
              <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
            ) : (
              <View style={styles.loading}>
                <Skeleton width={88} height={88} style={styles.avatarSkeleton} />
                <Skeleton width={300} height={54} />
                <Skeleton width={300} height={54} />
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileForm({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(profile);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  // O e-mail não muda aqui (a API exige o código no novo endereço): vai como está, só o nome muda.
  const errors = validateProfileForm({ name, email: saved.email });
  const changed = name.trim() !== saved.name;

  async function handleSave() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;

    const data = { name: name.trim(), email: saved.email };
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await runAuthenticated((token) => updateProfile(token, data));
      // O nome também fica na sessão (saudação do Dashboard).
      await updateSessionName(data.name);
      setSaved({ ...saved, name: data.name });
      setShowErrors(false);
      Alert.alert('Dados atualizados', 'Suas alterações foram salvas.');
    } catch (err) {
      if (err instanceof HandledActionError) return;
      setSubmitError(
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.avatar}>
        <Avatar name={name || profile.name} size={88} />
      </View>

      <View style={styles.fields}>
        <TextField
          label="Nome completo"
          icon={IconUser}
          value={name}
          onChangeText={setName}
          error={showErrors ? errors.name : undefined}
          maxLength={100}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          editable={!submitting}
        />
        <TextField
          label="E-mail"
          icon={IconMail}
          value={saved.email}
          editable={false}
          accessory={
            <Pressable
              onPress={() => router.push('/change-email')}
              disabled={submitting}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Alterar e-mail"
            >
              <Text style={styles.changeEmail}>Alterar</Text>
            </Pressable>
          }
        />
        <Text style={styles.hint}>
          O e-mail é usado para entrar no app. Para trocá-lo, enviamos um código ao novo endereço.
          Telefone ainda não pode ser editado por aqui.
        </Text>
      </View>

      <View style={styles.spacer} />

      {!!submitError && (
        <Text style={styles.submitError} accessibilityLiveRegion="polite">
          {submitError}
        </Text>
      )}
      <PrimaryButton
        title="Salvar alterações"
        onPress={handleSave}
        loading={submitting}
        disabled={!changed}
      />
    </ScrollView>
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
  loading: {
    alignItems: 'center',
    gap: 16,
  },
  avatarSkeleton: {
    borderRadius: 44,
  },
  avatar: {
    alignItems: 'center',
    marginBottom: 24,
  },
  fields: {
    gap: 18,
  },
  changeEmail: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
  },
  hint: {
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
