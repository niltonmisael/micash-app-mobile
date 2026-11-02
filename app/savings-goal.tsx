import IconArrowDownLeft from '@tabler/icons-react-native/IconArrowDownLeft';
import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import IconArrowUpRight from '@tabler/icons-react-native/IconArrowUpRight';
import IconDots from '@tabler/icons-react-native/IconDots';
import IconPencil from '@tabler/icons-react-native/IconPencil';
import IconTrash from '@tabler/icons-react-native/IconTrash';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { DonutChart } from '@/components/DonutChart';
import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import {
  savingsDeadlineLabel,
  savingsGoalTint,
  savingsPercentLabel,
} from '@/components/SavingsGoalRow';
import { SavingsMovementSheet } from '@/components/SavingsMovementSheet';
import { Skeleton, TransactionRowSkeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { SessionEndedError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import { deleteSavingsGoal, getSavingsGoal } from '@/lib/savings';
import { SavingsMovementType } from '@/types/savings';
import type { SavingsGoal, SavingsMovement } from '@/types/savings';
import { formatCurrency, formatRelativeDate } from '@/utils/format';

/** Detalhe de uma meta de economia (`?id=`): progresso, histórico e "Guardar dinheiro". */
export default function SavingsGoalScreen() {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);

  const fetchGoal = useCallback((token: string) => getSavingsGoal(token, id), [id]);
  const {
    data: goal,
    loading,
    refreshing,
    error,
    refresh,
    retry,
  } = useAuthenticatedQuery(fetchGoal);

  const [menuOpen, setMenuOpen] = useState(false);
  const [movement, setMovement] = useState<SavingsMovementType>();
  const [deleting, setDeleting] = useState(false);

  function edit() {
    setMenuOpen(false);
    router.push({ pathname: '/goal-form', params: { type: 'savings', id: String(id) } });
  }

  function withdraw() {
    setMenuOpen(false);
    setMovement(SavingsMovementType.Withdrawal);
  }

  function confirmDelete(current: SavingsGoal) {
    setMenuOpen(false);
    Alert.alert(
      'Excluir meta',
      `Excluir "${current.name}"? Todo o histórico de depósitos e retiradas também será apagado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: remove },
      ],
    );
  }

  async function remove() {
    setDeleting(true);
    try {
      await runAuthenticated((token) => deleteSavingsGoal(token, id));
      router.back();
    } catch (err) {
      if (err instanceof SessionEndedError) return;
      Alert.alert(
        'Não foi possível excluir',
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setDeleting(false);
    }
  }

  function movementDone() {
    setMovement(undefined);
    refresh();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <IconArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {goal?.name ?? 'Meta'}
        </Text>
        {deleting ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Pressable
            onPress={() => setMenuOpen(true)}
            disabled={!goal}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Mais opções"
          >
            <IconDots size={24} color={goal ? colors.textPrimary : colors.grayInactive} />
          </Pressable>
        )}
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
        {!!error && (
          <ErrorNotice
            message={goal ? error : 'Não foi possível carregar a meta. Ela pode ter sido excluída.'}
            onRetry={retry}
            retrying={loading || refreshing}
          />
        )}
        {goal ? <GoalDetails goal={goal} /> : loading && <DetailsSkeleton />}
      </ScrollView>

      {goal && (
        <View style={styles.footer}>
          <PrimaryButton
            title="Guardar dinheiro"
            onPress={() => setMovement(SavingsMovementType.Deposit)}
            disabled={deleting}
          />
        </View>
      )}

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {goal && (
          <>
            <View style={styles.menuHeader}>
              <CategoryIcon icon={goal.icon} color={goal.color} size={36} />
              <View style={styles.menuTexts}>
                <Text style={styles.menuTitle} numberOfLines={1}>
                  {goal.name}
                </Text>
                <Text style={styles.menuSubtitle}>
                  Guardado: {formatCurrency(goal.savedAmount)}
                </Text>
              </View>
            </View>
            <MenuOption
              label="Editar meta"
              icon={<IconPencil size={20} color={colors.textPrimary} />}
              onPress={edit}
            />
            {/* Sem nada guardado não há o que retirar (a API recusaria). */}
            {goal.savedAmount > 0 && (
              <MenuOption
                label="Retirar dinheiro"
                icon={<IconArrowUpRight size={20} color={colors.textPrimary} />}
                onPress={withdraw}
              />
            )}
            <MenuOption
              label="Excluir meta"
              icon={<IconTrash size={20} color={colors.expense} />}
              destructive
              onPress={() => confirmDelete(goal)}
            />
            <Pressable
              style={styles.cancel}
              onPress={() => setMenuOpen(false)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </>
        )}
      </BottomSheet>

      {goal && (
        <SavingsMovementSheet
          type={movement}
          goalId={goal.id}
          goalName={goal.name}
          savedAmount={goal.savedAmount}
          onClose={() => setMovement(undefined)}
          onDone={movementDone}
        />
      )}
    </SafeAreaView>
  );
}

function GoalDetails({ goal }: { goal: SavingsGoal }) {
  const tint = savingsGoalTint(goal);
  const filled = Math.min(Math.max(goal.percentage, 0), 100);

  return (
    <>
      <View style={styles.progressCard}>
        <View style={styles.donut}>
          <DonutChart
            segments={[
              { value: filled, color: tint },
              { value: 100 - filled, color: colors.grayLight },
            ]}
            size={150}
            thickness={16}
          />
          <View style={styles.donutCenter}>
            <Text style={styles.donutPercent}>{savingsPercentLabel(goal.percentage)}</Text>
            <Text style={styles.donutLabel}>concluído</Text>
          </View>
        </View>
        <Text style={styles.amounts}>
          <Text style={styles.saved}>{formatCurrency(goal.savedAmount)}</Text> de{' '}
          {formatCurrency(goal.targetAmount)}
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Falta" value={formatCurrency(goal.remainingAmount)} />
        <Stat label="Prazo" value={savingsDeadlineLabel(goal.deadline)} />
        <Stat
          label="Por mês"
          value={goal.monthlyAmountNeeded !== null ? formatCurrency(goal.monthlyAmountNeeded) : '—'}
        />
      </View>

      <Text style={styles.sectionTitle}>Histórico</Text>
      <View style={styles.card}>
        {goal.movements.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhum depósito ainda. Toque em “Guardar dinheiro” para começar.
          </Text>
        ) : (
          goal.movements.map((item, index) => (
            <MovementRow
              key={item.id}
              movement={item}
              divider={index < goal.movements.length - 1}
            />
          ))
        )}
      </View>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function MovementRow({ movement, divider }: { movement: SavingsMovement; divider: boolean }) {
  const isDeposit = movement.type === SavingsMovementType.Deposit;
  const label = isDeposit ? 'Depósito' : 'Retirada';
  const amount = `${isDeposit ? '+' : '-'}${formatCurrency(movement.amount)}`;
  const date = formatRelativeDate(movement.date);
  const Icon = isDeposit ? IconArrowDownLeft : IconArrowUpRight;

  return (
    <View
      style={[styles.movement, divider && styles.divider]}
      accessible
      accessibilityLabel={`${label}: ${amount}, ${date}`}
    >
      <View style={[styles.movementIcon, isDeposit ? styles.depositIcon : styles.withdrawalIcon]}>
        <Icon size={18} color={isDeposit ? colors.income : colors.expense} />
      </View>
      <Text style={styles.movementLabel}>{label}</Text>
      <View style={styles.movementValues}>
        <Text style={[styles.movementAmount, isDeposit ? styles.deposit : styles.withdrawal]}>
          {amount}
        </Text>
        <Text style={styles.movementDate}>{date}</Text>
      </View>
    </View>
  );
}

function DetailsSkeleton() {
  return (
    <>
      <View style={[styles.progressCard, styles.skeletonCard]}>
        <Skeleton width={150} height={150} style={styles.round} />
        <Skeleton width={180} height={16} />
      </View>
      <View style={styles.stats}>
        {Array.from({ length: 3 }, (_, index) => (
          <View key={index} style={styles.stat}>
            <Skeleton width={60} height={28} />
          </View>
        ))}
      </View>
      <View style={styles.card}>
        {Array.from({ length: 3 }, (_, index) => (
          <TransactionRowSkeleton key={index} />
        ))}
      </View>
    </>
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
    fontSize: 20,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  progressCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  skeletonCard: {
    gap: 16,
  },
  round: {
    borderRadius: 75,
  },
  donut: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPercent: {
    fontFamily: fonts.semiBold,
    fontSize: 30,
    color: colors.textPrimary,
  },
  donutLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  amounts: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  saved: {
    fontFamily: fonts.semiBold,
    color: colors.textPrimary,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.beige,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  movement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  movementIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositIcon: {
    backgroundColor: colors.incomeSoft,
  },
  withdrawalIcon: {
    backgroundColor: colors.expenseSoft,
  },
  movementLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  movementValues: {
    alignItems: 'flex-end',
  },
  movementAmount: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  deposit: {
    color: colors.income,
  },
  withdrawal: {
    color: colors.expense,
  },
  movementDate: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  menuTexts: {
    flex: 1,
  },
  menuTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  menuSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuPressed: {
    backgroundColor: colors.cream,
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
