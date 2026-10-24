import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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

import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_ICON_KEYS,
  isKnownCategoryIcon,
} from '@/components/CategoryIcon';
import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { SessionEndedError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import { createCategory, getCategory, updateCategory } from '@/lib/categories';
import type { Category } from '@/types/transactions';
import { validateCategoryForm } from '@/utils/validation';

/** Limite da coluna `name` no banco (CategoryConfiguration). */
const NAME_MAX_LENGTH = 100;

/** Cadastro (sem `id`) e edição (`?id=`) de categorias de despesa. */
export default function CategoryFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;
  const isEdit = id !== undefined && Number.isFinite(id);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <IconArrowLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {isEdit ? 'Editar categoria' : 'Nova categoria'}
          </Text>
        </View>

        {isEdit ? <EditCategory id={id} /> : <CategoryForm />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Carrega a categoria real pelo id antes de exibir o formulário preenchido. */
function EditCategory({ id }: { id: number }) {
  const fetchCategory = useCallback((token: string) => getCategory(token, id), [id]);
  const { data, loading, refreshing, error, retry } = useAuthenticatedQuery(fetchCategory);

  if (data) return <CategoryForm category={data} />;

  return (
    <View style={styles.content}>
      {error ? (
        <ErrorNotice
          message="Não foi possível carregar a categoria. Ela pode ter sido excluída."
          onRetry={retry}
          retrying={loading || refreshing}
        />
      ) : (
        <View style={styles.loading}>
          <Skeleton width={120} height={14} />
          <Skeleton width={300} height={54} />
          <Skeleton width={120} height={14} />
          <Skeleton width={300} height={120} />
        </View>
      )}
    </View>
  );
}

function CategoryForm({ category }: { category?: Category }) {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();

  // Valores antigos fora da convenção do app (ex.: icon "comida", color "amarelo") não são
  // pré-selecionados: o usuário escolhe um ícone e uma cor válidos ao editar.
  const legacyAppearance =
    !!category &&
    (!isKnownCategoryIcon(category.icon) || !CATEGORY_COLORS.includes(category.color));
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState<string | undefined>(
    category && isKnownCategoryIcon(category.icon) ? category.icon : undefined,
  );
  const [color, setColor] = useState<string | undefined>(
    category && CATEGORY_COLORS.includes(category.color) ? category.color : undefined,
  );
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const errors = validateCategoryForm({ name, icon, color });

  async function handleSave() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;

    const data = { name: name.trim(), icon: icon as string, color: color as string };
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await runAuthenticated((token) =>
        category ? updateCategory(token, category.id, data) : createCategory(token, data),
      );
      router.back();
      Alert.alert(category ? 'Categoria atualizada' : 'Categoria criada', data.name);
    } catch (error) {
      if (error instanceof SessionEndedError) return;
      setSubmitError(
        error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.fields}>
        <TextField
          label="Nome da categoria"
          value={name}
          onChangeText={setName}
          error={showErrors ? errors.name : undefined}
          placeholder="Ex: Alimentação"
          maxLength={NAME_MAX_LENGTH}
          editable={!submitting}
        />

        {legacyAppearance && (
          <Text style={styles.hint}>
            Esta categoria foi criada com um ícone ou uma cor fora do padrão do app. Escolha novos
            abaixo para salvar.
          </Text>
        )}

        <View>
          <Text style={styles.label}>Ícone</Text>
          <View style={styles.iconGrid} accessibilityRole="radiogroup">
            {CATEGORY_ICON_KEYS.map((key) => {
              const Icon = CATEGORY_ICONS[key];
              const selected = key === icon;
              return (
                <Pressable
                  key={key}
                  style={[styles.iconOption, selected && styles.iconOptionSelected]}
                  onPress={() => setIcon(key)}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityLabel={`Ícone ${key}`}
                  accessibilityState={{ selected }}
                >
                  <Icon
                    size={22}
                    color={selected ? (color ?? colors.primary) : colors.textPrimary}
                  />
                </Pressable>
              );
            })}
          </View>
          {showErrors && !!errors.icon && <Text style={styles.error}>{errors.icon}</Text>}
        </View>

        <View>
          <Text style={styles.label}>Cor</Text>
          <View style={styles.colorRow} accessibilityRole="radiogroup">
            {CATEGORY_COLORS.map((value) => {
              const selected = value === color;
              return (
                <Pressable
                  key={value}
                  style={[styles.colorRing, selected && { borderColor: value }]}
                  onPress={() => setColor(value)}
                  disabled={submitting}
                  hitSlop={4}
                  accessibilityRole="radio"
                  accessibilityLabel={`Cor ${value}`}
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.colorDot, { backgroundColor: value }]} />
                </Pressable>
              );
            })}
          </View>
          {showErrors && !!errors.color && <Text style={styles.error}>{errors.color}</Text>}
        </View>
      </View>

      <View style={styles.spacer} />

      {!!submitError && (
        <Text style={styles.submitError} accessibilityLiveRegion="polite">
          {submitError}
        </Text>
      )}
      <PrimaryButton
        title={category ? 'Salvar alterações' : 'Salvar'}
        onPress={handleSave}
        loading={submitting}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  loading: {
    gap: 12,
  },
  fields: {
    gap: 22,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.cream,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.beige,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.expense,
    marginTop: 8,
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
