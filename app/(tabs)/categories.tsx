import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import IconChevronRight from '@tabler/icons-react-native/IconChevronRight';
import IconPencil from '@tabler/icons-react-native/IconPencil';
import IconPlus from '@tabler/icons-react-native/IconPlus';
import IconTrash from '@tabler/icons-react-native/IconTrash';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ErrorNotice } from '@/components/ErrorNotice';
import { TransactionRowSkeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { SessionEndedError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import { deleteCategory, getCategories } from '@/lib/categories';
import type { Category } from '@/types/transactions';

export default function CategoriesScreen() {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const { data, loading, refreshing, error, refresh, retry } = useAuthenticatedQuery(getCategories);
  const [menuCategory, setMenuCategory] = useState<Category>();
  const [deletingId, setDeletingId] = useState<number>();

  function editCategory(category: Category) {
    setMenuCategory(undefined);
    router.push({ pathname: '/category-form', params: { id: String(category.id) } });
  }

  function confirmDelete(category: Category) {
    setMenuCategory(undefined);
    Alert.alert(
      'Excluir categoria',
      `Excluir "${category.name}"? Ela deixará de aparecer na lista. As despesas já registradas continuam com essa categoria.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => remove(category) },
      ],
    );
  }

  async function remove(category: Category) {
    setDeletingId(category.id);
    try {
      await runAuthenticated((token) => deleteCategory(token, category.id));
      // A lista só muda depois da confirmação da API.
      await refresh();
      Alert.alert('Categoria excluída', category.name);
    } catch (err) {
      if (err instanceof SessionEndedError) return;
      Alert.alert(
        'Não foi possível excluir',
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
    } finally {
      setDeletingId(undefined);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <IconArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Categorias
        </Text>
        <Pressable
          style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
          onPress={() => router.push('/category-form')}
          accessibilityRole="button"
          accessibilityLabel="Nova categoria"
        >
          <IconPlus size={18} color={colors.white} />
          <Text style={styles.newButtonText}>Nova</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* A API só tem categorias de despesa; as de receita são um enum fixo do formulário de receita. */}
        <Text style={styles.subtitle}>Categorias usadas nas suas despesas.</Text>
        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}
        {loading && !data ? (
          <View style={styles.card}>
            {Array.from({ length: 4 }, (_, index) => (
              <TransactionRowSkeleton key={index} />
            ))}
          </View>
        ) : data && data.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>
              Você ainda não tem categorias de despesa. Toque em &quot;Nova&quot; para criar a
              primeira.
            </Text>
          </View>
        ) : data ? (
          <View style={styles.card}>
            {data.map((category, index) => (
              <View
                key={category.id}
                style={[styles.row, index < data.length - 1 && styles.divider]}
              >
                <CategoryIcon icon={category.icon} color={category.color} />
                <Text style={styles.name} numberOfLines={1}>
                  {category.name}
                </Text>
                {deletingId === category.id ? (
                  <ActivityIndicator color={colors.primary} style={styles.menuButton} />
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.menuButton, pressed && styles.menuPressed]}
                    onPress={() => setMenuCategory(category)}
                    disabled={deletingId !== undefined}
                    accessibilityRole="button"
                    accessibilityLabel={`Opções da categoria ${category.name}`}
                  >
                    <IconChevronRight size={20} color={colors.grayMedium} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet visible={!!menuCategory} onClose={() => setMenuCategory(undefined)}>
        {menuCategory && (
          <>
            <View style={styles.menuHeader}>
              <CategoryIcon icon={menuCategory.icon} color={menuCategory.color} size={36} />
              <Text style={styles.menuTitle} numberOfLines={1}>
                {menuCategory.name}
              </Text>
            </View>
            <MenuOption
              label="Editar categoria"
              icon={<IconPencil size={20} color={colors.textPrimary} />}
              onPress={() => editCategory(menuCategory)}
            />
            <MenuOption
              label="Excluir categoria"
              icon={<IconTrash size={20} color={colors.expense} />}
              destructive
              onPress={() => confirmDelete(menuCategory)}
            />
            <Pressable
              style={styles.cancel}
              onPress={() => setMenuCategory(undefined)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

function MenuOption({
  label,
  icon,
  destructive,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuOption, pressed && styles.menuPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {icon}
      <Text style={[styles.menuOptionText, destructive && styles.destructive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: colors.textPrimary,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  newButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingLeft: 18,
    paddingRight: 6,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  name: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPressed: {
    backgroundColor: colors.cream,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  menuTitle: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuOptionText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  destructive: {
    color: colors.expense,
  },
  cancel: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
