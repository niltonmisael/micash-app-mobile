import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import IconChevronLeft from '@tabler/icons-react-native/IconChevronLeft';
import IconChevronRight from '@tabler/icons-react-native/IconChevronRight';
import IconCrown from '@tabler/icons-react-native/IconCrown';
import IconLock from '@tabler/icons-react-native/IconLock';
import IconPencil from '@tabler/icons-react-native/IconPencil';
import IconPlus from '@tabler/icons-react-native/IconPlus';
import IconTrash from '@tabler/icons-react-native/IconTrash';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { GoalLimitRow } from '@/components/GoalLimitRow';
import { PremiumLockedCard } from '@/components/PremiumLockedCard';
import { SavingsGoalRow } from '@/components/SavingsGoalRow';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TransactionRowSkeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { PREMIUM_OFFERS } from '@/constants/plans';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { usePlan } from '@/hooks/usePlan';
import { ApiError } from '@/lib/api';
import { copyGoals, deleteGoal, getGoalLimits } from '@/lib/goals';
import { getSavingsGoals } from '@/lib/savings';
import { isHistoryLocked, reachedLimit } from '@/lib/subscription';
import type { GoalLimit } from '@/types/goals';
import { formatCurrency } from '@/utils/format';
import { currentPeriod, monthYearLabel, samePeriod, shiftPeriod } from '@/utils/period';
import type { MonthPeriod } from '@/utils/period';

type GoalTab = 'savings' | 'limits';

const TAB_OPTIONS: { key: GoalTab; label: string }[] = [
  { key: 'savings', label: 'Economia' },
  { key: 'limits', label: 'Limites de gasto' },
];

/** Meses à frente que dá para navegar (planejar limites dos próximos meses). */
const MONTHS_AHEAD = 11;

/** Metas de economia e limites de gasto (`?tab=limits` abre direto nos limites). */
export default function GoalsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: GoalTab = params.tab === 'limits' ? 'limits' : 'savings';
  // O mês fica aqui (e não na aba) para não se perder ao alternar entre Economia e Limites.
  const [period, setPeriod] = useState<MonthPeriod>(() => currentPeriod());
  const { limits, showOffer } = usePlan();
  // Quantas metas a aba visível mostra (caixinhas, ou limites do mês escolhido), para o plano.
  const [count, setCount] = useState<number>();

  const now = currentPeriod();
  // Meses passados ficam só para consulta: não faz sentido criar ou copiar limites para eles.
  const isPast = period.year * 12 + period.month < now.year * 12 + now.month;
  const newDisabled = tab === 'limits' && isPast;
  // No Free, criar acima do limite abre a oferta (a API também recusa com 403).
  const atPlanLimit =
    count !== undefined &&
    reachedLimit(
      tab === 'savings' ? limits?.maxSavingsGoals : limits?.maxFinancialGoalsPerMonth,
      count,
    );

  function openNew() {
    if (atPlanLimit) {
      if (tab === 'savings') showOffer(PREMIUM_OFFERS.savings, 'Caixinhas ilimitadas');
      else showOffer(PREMIUM_OFFERS.goals, 'Metas ilimitadas');
      return;
    }
    if (tab === 'savings') {
      router.push({ pathname: '/goal-form', params: { type: 'savings' } });
      return;
    }
    router.push({
      pathname: '/goal-form',
      params: { month: String(period.month), year: String(period.year) },
    });
  }

  const tabs = (
    <SegmentedControl
      options={TAB_OPTIONS}
      value={tab}
      onChange={(next) => {
        setCount(undefined);
        router.setParams({ tab: next });
      }}
      style={styles.tabs}
    />
  );

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
          Metas
        </Text>
        <Pressable
          style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
          onPress={openNew}
          disabled={newDisabled}
          accessibilityRole="button"
          accessibilityLabel={`${tab === 'savings' ? 'Nova meta de economia' : 'Novo limite de gasto'}${atPlanLimit ? ', recurso Premium' : ''}`}
          accessibilityState={{ disabled: newDisabled }}
        >
          {atPlanLimit ? (
            <IconCrown size={18} color={colors.white} />
          ) : (
            <IconPlus size={18} color={colors.white} />
          )}
          <Text style={styles.newButtonText}>Nova</Text>
        </Pressable>
      </View>

      {/* Só a aba visível fica montada: cada uma carrega os próprios dados ao aparecer. */}
      {tab === 'savings' ? (
        <SavingsTab tabs={tabs} onCreate={openNew} onCount={setCount} />
      ) : (
        <LimitsTab
          tabs={tabs}
          period={period}
          onChangePeriod={setPeriod}
          isPast={isPast}
          onCreate={openNew}
          onCount={setCount}
        />
      )}
    </SafeAreaView>
  );
}

/** Metas de economia (cofrinhos), na ordem da API: em andamento por prazo, depois concluídas. */
function SavingsTab({
  tabs,
  onCreate,
  onCount,
}: {
  tabs: ReactNode;
  onCreate: () => void;
  onCount: (count: number | undefined) => void;
}) {
  const router = useRouter();
  const {
    data: goals,
    loading,
    refreshing,
    error,
    refresh,
    retry,
  } = useAuthenticatedQuery(getSavingsGoals);

  useEffect(() => {
    onCount(goals?.length);
  }, [goals, onCount]);

  return (
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
      {tabs}

      {!!error && <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />}

      {!goals ? (
        loading ? (
          <View style={styles.card}>
            {Array.from({ length: 3 }, (_, index) => (
              <TransactionRowSkeleton key={index} />
            ))}
          </View>
        ) : null
      ) : goals.length === 0 ? (
        <View style={[styles.card, styles.emptyCard]}>
          <Text style={styles.emptyTitle}>Nenhuma meta de economia</Text>
          <Text style={styles.emptyText}>
            Defina quanto quer juntar para uma viagem, uma reserva ou uma compra e acompanhe cada
            depósito.
          </Text>
          <View style={styles.emptyActions}>
            <Pressable
              style={({ pressed }) => [styles.emptyPrimary, pressed && styles.pressed]}
              onPress={onCreate}
              accessibilityRole="button"
            >
              <Text style={styles.emptyPrimaryText}>Criar meta</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        goals.map((goal) => (
          <View key={goal.id} style={styles.card}>
            <SavingsGoalRow
              goal={goal}
              onPress={() =>
                router.push({ pathname: '/savings-goal', params: { id: String(goal.id) } })
              }
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}

type LimitsTabProps = {
  tabs: ReactNode;
  period: MonthPeriod;
  onChangePeriod: (period: MonthPeriod) => void;
  isPast: boolean;
  onCreate: () => void;
  onCount: (count: number | undefined) => void;
};

/** Limites de gasto por categoria do mês escolhido. */
function LimitsTab({ tabs, period, onChangePeriod, isPast, onCreate, onCount }: LimitsTabProps) {
  const router = useRouter();
  const { limits: plan, showOffer } = usePlan();
  const runAuthenticated = useAuthenticatedAction();
  const [menuLimit, setMenuLimit] = useState<GoalLimit>();
  const [busy, setBusy] = useState(false);

  const fetchGoals = useCallback(
    async (token: string) => ({ period, limits: await getGoalLimits(token, period) }),
    [period],
  );
  const { data, locked, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(fetchGoals);

  // Ao trocar o mês, os dados anteriores continuam visíveis (esmaecidos) até a resposta chegar.
  const changingPeriod = !!data && !samePeriod(data.period, period);
  const limits = data?.limits;
  const previous = shiftPeriod(period, -1);
  const lastPeriod = shiftPeriod(currentPeriod(), MONTHS_AHEAD);
  // No Free, meses antes do histórico do plano ficam com cadeado.
  const previousLocked = isHistoryLocked(plan, previous);
  const maxGoals = plan?.maxFinancialGoalsPerMonth ?? null;
  const canCopy = !plan || plan.canCopyFinancialGoals;
  const showHistoryOffer = () => showOffer(PREMIUM_OFFERS.history, 'Histórico completo');

  // Conta só as metas do mês escolhido (não as do mês anterior, ainda visíveis na troca).
  useEffect(() => {
    onCount(limits && !changingPeriod ? limits.length : undefined);
  }, [limits, changingPeriod, onCount]);

  function editLimit(limit: GoalLimit) {
    setMenuLimit(undefined);
    router.push({ pathname: '/goal-form', params: { id: String(limit.id) } });
  }

  function confirmDelete(limit: GoalLimit) {
    setMenuLimit(undefined);
    Alert.alert('Excluir limite', `Excluir o limite de "${limit.name}" deste mês?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => remove(limit) },
    ]);
  }

  async function remove(limit: GoalLimit) {
    setBusy(true);
    try {
      await runAuthenticated((token) => deleteGoal(token, limit.id));
      await refresh();
    } catch (err) {
      if (err instanceof HandledActionError) return;
      Alert.alert(
        'Não foi possível excluir',
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyFromPrevious() {
    setBusy(true);
    try {
      await runAuthenticated((token) => copyGoals(token, previous, period));
      await refresh();
    } catch (err) {
      if (err instanceof HandledActionError) return;
      Alert.alert(
        'Não foi possível copiar',
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
        {tabs}

        <View style={styles.monthRow}>
          <MonthArrow
            direction="previous"
            onPress={previousLocked ? showHistoryOffer : () => onChangePeriod(previous)}
            label={monthYearLabel(previous)}
            locked={previousLocked}
          />
          <View style={styles.monthCenter}>
            <Text style={styles.monthText}>{monthYearLabel(period)}</Text>
            {changingPeriod && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          <MonthArrow
            direction="next"
            onPress={() => onChangePeriod(shiftPeriod(period, 1))}
            label={monthYearLabel(shiftPeriod(period, 1))}
            disabled={samePeriod(period, lastPeriod)}
          />
        </View>

        {maxGoals !== null && limits && !changingPeriod && !isPast && (
          <View style={styles.usageRow}>
            {limits.length >= maxGoals && <IconCrown size={14} color={colors.primary} />}
            <Text style={styles.usageText}>
              {limits.length} de {maxGoals} metas
            </Text>
          </View>
        )}

        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        <View style={changingPeriod && styles.stale}>
          {locked ? (
            <PremiumLockedCard
              title="Histórico completo"
              message={locked}
              onPress={() => showOffer(locked, 'Histórico completo')}
            />
          ) : !limits ? (
            loading ? (
              <View style={styles.card}>
                {Array.from({ length: 3 }, (_, index) => (
                  <TransactionRowSkeleton key={index} />
                ))}
              </View>
            ) : null
          ) : limits.length === 0 ? (
            <View style={[styles.card, styles.emptyCard]}>
              <Text style={styles.emptyTitle}>Nenhum limite neste mês</Text>
              <Text style={styles.emptyText}>
                {isPast
                  ? 'Não há limites de gasto registrados para este mês.'
                  : 'Defina quanto quer gastar em cada categoria e acompanhe o quanto já usou.'}
              </Text>
              {!isPast && (
                <View style={styles.emptyActions}>
                  <Pressable
                    style={({ pressed }) => [styles.emptyPrimary, pressed && styles.pressed]}
                    onPress={onCreate}
                    disabled={busy}
                    accessibilityRole="button"
                  >
                    <Text style={styles.emptyPrimaryText}>Criar limite</Text>
                  </Pressable>
                  <Pressable
                    onPress={
                      canCopy
                        ? copyFromPrevious
                        : () => showOffer(PREMIUM_OFFERS.copyGoals, 'Copiar metas')
                    }
                    disabled={busy}
                    hitSlop={8}
                    style={styles.copyLink}
                    accessibilityRole="button"
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        {!canCopy && <IconCrown size={16} color={colors.primary} />}
                        <Text style={styles.emptyLink}>
                          Copiar limites de {monthYearLabel(previous).toLowerCase()}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            limits.map((limit) => (
              <View key={limit.id} style={styles.card}>
                <GoalLimitRow
                  limit={limit}
                  onPress={busy || changingPeriod ? undefined : () => setMenuLimit(limit)}
                />
              </View>
            ))
          )}
          {busy && !!limits?.length && (
            <ActivityIndicator color={colors.primary} style={styles.busy} />
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={!!menuLimit} onClose={() => setMenuLimit(undefined)}>
        {menuLimit && (
          <>
            <View style={styles.menuHeader}>
              <CategoryIcon icon={menuLimit.icon} color={menuLimit.color} size={36} />
              <View style={styles.menuTexts}>
                <Text style={styles.menuTitle} numberOfLines={1}>
                  {menuLimit.name}
                </Text>
                <Text style={styles.menuSubtitle}>
                  Limite de {formatCurrency(menuLimit.targetAmount)} em{' '}
                  {monthYearLabel(period).toLowerCase()}
                </Text>
              </View>
            </View>
            <MenuOption
              label="Editar valor do limite"
              icon={<IconPencil size={20} color={colors.textPrimary} />}
              onPress={() => editLimit(menuLimit)}
            />
            <MenuOption
              label="Excluir limite"
              icon={<IconTrash size={20} color={colors.expense} />}
              destructive
              onPress={() => confirmDelete(menuLimit)}
            />
            <Pressable
              style={styles.cancel}
              onPress={() => setMenuLimit(undefined)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </>
        )}
      </BottomSheet>
    </>
  );
}

function MonthArrow({
  direction,
  label,
  onPress,
  disabled,
  locked,
}: {
  direction: 'previous' | 'next';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Mês fora do histórico do plano: cadeado no lugar da seta; o toque abre a oferta. */
  locked?: boolean;
}) {
  const Icon = locked ? IconLock : direction === 'previous' ? IconChevronLeft : IconChevronRight;
  return (
    <Pressable
      style={({ pressed }) => [styles.monthArrow, pressed && styles.menuPressed]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}, histórico do Premium` : `Ir para ${label}`}
      accessibilityState={{ disabled }}
    >
      <Icon
        size={20}
        color={locked ? colors.primary : disabled ? colors.grayInactive : colors.textPrimary}
      />
    </Pressable>
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
  tabs: {
    marginBottom: 14,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  monthText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  stale: {
    opacity: 0.5,
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -4,
    marginBottom: 12,
  },
  usageText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  copyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyActions: {
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
  },
  emptyPrimary: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPrimaryText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.white,
  },
  emptyLink: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
  },
  busy: {
    marginTop: 4,
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
