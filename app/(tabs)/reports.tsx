import IconCheck from '@tabler/icons-react-native/IconCheck';
import IconChevronDown from '@tabler/icons-react-native/IconChevronDown';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart } from '@/components/BarChart';
import { BottomSheet } from '@/components/BottomSheet';
import { DonutChart } from '@/components/DonutChart';
import { ErrorNotice } from '@/components/ErrorNotice';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { EVOLUTION_MONTHS, getReport } from '@/lib/reports';
import { formatCurrency, formatPercent } from '@/utils/format';
import {
  currentPeriod,
  periodLabel,
  samePeriod,
  shiftPeriod,
  shortMonthLabel,
} from '@/utils/period';
import type { MonthPeriod } from '@/utils/period';

/** Meses oferecidos no filtro: o atual e os 11 anteriores (a API aceita qualquer ano/mês). */
const PERIOD_OPTIONS = 12;

export default function ReportsScreen() {
  const [period, setPeriod] = useState<MonthPeriod>(() => currentPeriod());
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchReport = useCallback((token: string) => getReport(token, period), [period]);
  const { data, loading, refreshing, error, refresh, retry } = useAuthenticatedQuery(fetchReport);

  // Ao trocar o período, os dados anteriores continuam visíveis (esmaecidos) até a resposta chegar.
  const changingPeriod = !!data && !samePeriod(data.period, period);
  const label = periodLabel(period);
  const periodOptions = Array.from({ length: PERIOD_OPTIONS }, (_, index) =>
    shiftPeriod(currentPeriod(), -index),
  );
  const hasEvolution = !!data && data.evolution.some((month) => month.totalExpense > 0);

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
        <Text style={styles.title} accessibilityRole="header">
          Relatórios
        </Text>

        <View style={styles.periodRow}>
          <Pressable
            style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Período: ${label}`}
          >
            <Text style={styles.periodText}>{label}</Text>
            <IconChevronDown size={16} color={colors.textSecondary} />
          </Pressable>
          {changingPeriod && <ActivityIndicator color={colors.primary} />}
        </View>

        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        <View style={[styles.card, changingPeriod && styles.stale]}>
          <Text style={styles.cardTitle}>Despesas por categoria</Text>
          {!data ? (
            loading ? (
              <View style={styles.summaryRow}>
                <Skeleton width={120} height={120} style={styles.round} />
                <View style={styles.totalBox}>
                  <Skeleton width={50} height={14} />
                  <Skeleton width={120} height={24} />
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>Relatório indisponível no momento.</Text>
            )
          ) : data.categories.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma despesa registrada neste período.</Text>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <DonutChart
                  segments={data.categories.map((category) => ({
                    value: category.amount,
                    color: category.color,
                  }))}
                />
                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit>
                    {formatCurrency(data.totalExpense)}
                  </Text>
                </View>
              </View>

              <View style={styles.legend}>
                {data.categories.map((category) => (
                  <View
                    key={category.id}
                    style={styles.legendRow}
                    accessible
                    accessibilityLabel={`${category.name}: ${formatCurrency(category.amount)}, ${formatPercent(category.percentage)}`}
                  >
                    <View style={[styles.legendDot, { backgroundColor: category.color }]} />
                    <Text style={styles.legendName} numberOfLines={1}>
                      {category.name}
                    </Text>
                    <Text style={styles.legendValue}>
                      {formatCurrency(category.amount)}{' '}
                      <Text style={styles.legendPercent}>
                        ({formatPercent(category.percentage)})
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={[styles.card, changingPeriod && styles.stale]}>
          <Text style={styles.cardTitle}>Evolução mensal</Text>
          <Text style={styles.cardSubtitle}>Despesas dos últimos {EVOLUTION_MONTHS} meses</Text>
          {!data ? (
            loading ? (
              <Skeleton width={280} height={130} />
            ) : (
              <Text style={styles.emptyText}>Evolução indisponível no momento.</Text>
            )
          ) : !hasEvolution ? (
            <Text style={styles.emptyText}>
              Nenhuma despesa nos últimos {EVOLUTION_MONTHS} meses.
            </Text>
          ) : (
            <BarChart
              bars={data.evolution.map((month) => ({
                label: shortMonthLabel(month.period),
                value: month.totalExpense,
                highlighted: samePeriod(month.period, data.period),
                accessibilityLabel: `${periodLabel(month.period)}: ${formatCurrency(month.totalExpense)}`,
              }))}
            />
          )}
        </View>
      </ScrollView>

      <BottomSheet visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          Período
        </Text>
        <ScrollView style={styles.sheetList}>
          {periodOptions.map((option) => {
            const selected = samePeriod(option, period);
            return (
              <Pressable
                key={`${option.year}-${option.month}`}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => {
                  setPeriod(option);
                  setPickerOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {periodLabel(option)}
                </Text>
                {selected && <IconCheck size={20} color={colors.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
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
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.85,
  },
  periodText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  stale: {
    opacity: 0.5,
  },
  cardTitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 14,
  },
  cardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -10,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  round: {
    borderRadius: 60,
  },
  totalBox: {
    flex: 1,
    gap: 4,
  },
  totalLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  totalValue: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: colors.textPrimary,
  },
  legend: {
    marginTop: 18,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  legendName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
    marginRight: 8,
  },
  legendValue: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  legendPercent: {
    color: colors.textSecondary,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sheetTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  sheetList: {
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  optionPressed: {
    backgroundColor: colors.cream,
  },
  optionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
});
