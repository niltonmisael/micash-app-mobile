import IconBell from '@tabler/icons-react-native/IconBell';
import IconEye from '@tabler/icons-react-native/IconEye';
import IconEyeOff from '@tabler/icons-react-native/IconEyeOff';
import IconSparkles from '@tabler/icons-react-native/IconSparkles';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { GoalLimitRow } from '@/components/GoalLimitRow';
import { Skeleton, TransactionRowSkeleton } from '@/components/Skeleton';
import { TransactionRow } from '@/components/TransactionRow';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { getDashboard } from '@/lib/dashboard';
import { getSettings } from '@/lib/settings';
import { formatCurrency } from '@/utils/format';

const HIDDEN_VALUE = 'R$ ••••••';

export default function DashboardScreen() {
  const router = useRouter();
  const { data, firstName, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(getDashboard);
  const [balanceHidden, setBalanceHidden] = useState(false);

  // "Exibir saldo na tela inicial" (Configurações) define se o saldo abre visível ou oculto.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSettings().then((settings) => {
        if (active) setBalanceHidden(!settings.showBalance);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const summary = data?.summary;
  const goals = data?.goals;
  const showSkeleton = loading && !data;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
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
        <View style={styles.header}>
          <Text style={styles.greeting} accessibilityRole="header" numberOfLines={1}>
            {firstName ? `Olá, ${firstName} 👋` : 'Olá 👋'}
          </Text>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerButton, styles.assistantButton]}
              onPress={() => router.push('/assistant')}
              accessibilityRole="button"
              accessibilityLabel="MI Assistente"
            >
              <IconSparkles size={22} color={colors.primary} />
            </Pressable>
            <Pressable
              style={styles.headerButton}
              onPress={() =>
                Alert.alert(
                  'Em breve',
                  'As notificações estarão disponíveis em uma próxima versão.',
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Notificações"
            >
              <IconBell size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>Saldo do mês</Text>
            <Pressable
              onPress={() => setBalanceHidden((hidden) => !hidden)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={balanceHidden ? 'Mostrar saldo' : 'Ocultar saldo'}
            >
              {balanceHidden ? (
                <IconEyeOff size={20} color={colors.textSecondary} />
              ) : (
                <IconEye size={20} color={colors.textSecondary} />
              )}
            </Pressable>
          </View>
          {summary ? (
            <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>
              {balanceHidden ? HIDDEN_VALUE : formatCurrency(summary.balance)}
            </Text>
          ) : (
            <Skeleton width={180} height={32} style={styles.balanceSkeleton} />
          )}
        </View>

        <View style={styles.monthRow}>
          <View style={[styles.monthCard, styles.incomeCard]}>
            <Text style={[styles.monthLabel, styles.incomeLabel]}>Receitas do mês</Text>
            {summary ? (
              <Text style={styles.monthValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(summary.totalIncome)}
              </Text>
            ) : (
              <Skeleton width={100} height={20} tone="light" />
            )}
          </View>
          <View style={[styles.monthCard, styles.expenseCard]}>
            <Text style={styles.monthLabel}>Despesas do mês</Text>
            {summary ? (
              <Text style={styles.monthValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatCurrency(summary.totalExpense)}
              </Text>
            ) : (
              <Skeleton width={100} height={20} tone="light" />
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumo do mês</Text>
        <View style={styles.chartCard}>
          {/* A API ainda não tem valores por dia; o gráfico de linhas aguarda esse endpoint. */}
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>O gráfico diário estará disponível em breve.</Text>
          </View>
          <View style={styles.legend}>
            <LegendItem color={colors.income} label="Receitas" />
            <LegendItem color={colors.primary} label="Despesas" />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Metas</Text>
          <Pressable
            onPress={() => router.navigate({ pathname: '/goals', params: { tab: 'limits' } })}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={styles.seeAll}>Ver todas</Text>
          </Pressable>
        </View>
        <View style={[styles.listCard, styles.goalsCard]}>
          {showSkeleton ? (
            <TransactionRowSkeleton />
          ) : goals && goals.length > 0 ? (
            goals.map((limit, index) => (
              <GoalLimitRow
                key={limit.id}
                limit={limit}
                onPress={() => router.navigate({ pathname: '/goals', params: { tab: 'limits' } })}
                divider={index < goals.length - 1}
              />
            ))
          ) : goals ? (
            <Pressable
              onPress={() => router.navigate({ pathname: '/goals', params: { tab: 'limits' } })}
              accessibilityRole="button"
              style={styles.goalsEmpty}
            >
              <Text style={styles.goalsEmptyText}>
                Defina limites de gasto por categoria e acompanhe aqui.
              </Text>
              <Text style={styles.seeAll}>Criar limite</Text>
            </Pressable>
          ) : (
            <Text style={styles.emptyText}>Metas indisponíveis no momento.</Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimas movimentações</Text>
          <Pressable
            onPress={() => router.navigate('/transactions')}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={styles.seeAll}>Ver todas</Text>
          </Pressable>
        </View>
        <View style={styles.listCard}>
          {showSkeleton ? (
            Array.from({ length: 3 }, (_, index) => <TransactionRowSkeleton key={index} />)
          ) : data && data.transactions.length > 0 ? (
            data.transactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.key}
                transaction={transaction}
                showDate
                divider={index < data.transactions.length - 1}
              />
            ))
          ) : data ? (
            <Text style={styles.emptyText}>
              Nenhuma movimentação ainda. Suas receitas e despesas aparecerão aqui.
            </Text>
          ) : (
            <Text style={styles.emptyText}>Movimentações indisponíveis no momento.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  greeting: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 20,
    color: colors.textPrimary,
    marginRight: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantButton: {
    backgroundColor: colors.beige,
  },
  balanceCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  balanceValue: {
    fontFamily: fonts.medium,
    fontSize: 32,
    color: colors.textPrimary,
    marginTop: 6,
  },
  balanceSkeleton: {
    marginTop: 10,
  },
  monthRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  monthCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 6,
  },
  incomeCard: {
    backgroundColor: colors.beige,
  },
  expenseCard: {
    backgroundColor: colors.grayLight,
  },
  monthLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  incomeLabel: {
    color: colors.incomeLabel,
  },
  monthValue: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  seeAll: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 12,
    marginBottom: 22,
  },
  chartEmpty: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.cream,
  },
  chartEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  listCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  goalsCard: {
    marginBottom: 22,
  },
  goalsEmpty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  goalsEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
});
