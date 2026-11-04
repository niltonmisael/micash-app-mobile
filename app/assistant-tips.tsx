import IconAlertTriangle from '@tabler/icons-react-native/IconAlertTriangle';
import IconInfoCircle from '@tabler/icons-react-native/IconInfoCircle';
import IconSparkles from '@tabler/icons-react-native/IconSparkles';
import IconTrendingUp from '@tabler/icons-react-native/IconTrendingUp';
import type { ComponentType } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { PremiumLockedCard } from '@/components/PremiumLockedCard';
import { RichText } from '@/components/RichText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { PREMIUM_OFFERS } from '@/constants/plans';
import { fonts } from '@/constants/typography';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { usePlan } from '@/hooks/usePlan';
import { getInsights } from '@/lib/assistant';
import { InsightType } from '@/types/assistant';
import type { FinancialInsight } from '@/types/assistant';
import { currentPeriod, monthYearLabel } from '@/utils/period';

type Icon = ComponentType<{ size?: number; color?: string }>;

const INSIGHT_APPEARANCE: Record<InsightType, { icon: Icon; color: string; background: string }> = {
  [InsightType.Warning]: {
    icon: IconAlertTriangle,
    color: colors.expense,
    background: colors.expenseSoft,
  },
  [InsightType.Improvement]: {
    icon: IconTrendingUp,
    color: colors.income,
    background: colors.incomeSoft,
  },
  [InsightType.Information]: {
    icon: IconInfoCircle,
    color: colors.primary,
    background: colors.beige,
  },
};

/** Os insights são sempre do mês atual (data local do aparelho). */
const fetchInsights = (token: string) => getInsights(token, currentPeriod());

/**
 * Dicas do Mi: regras calculadas pela API + análise em texto gerada pela IA. No plano gratuito a
 * API manda uma prévia (um insight, sem a análise); os demais aparecem bloqueados.
 */
export default function AssistantTipsScreen() {
  const { data, locked, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(fetchInsights);
  const { showOffer } = usePlan();
  const monthLabel = monthYearLabel(currentPeriod()).toLowerCase();
  const openOffer = () => showOffer(PREMIUM_OFFERS.insights, 'Insights completos');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Dicas do Mi" />
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
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        {locked ? (
          <PremiumLockedCard
            title="Insights deste mês"
            message={locked}
            onPress={() => showOffer(locked)}
          />
        ) : !data ? (
          loading ? (
            <>
              <View style={styles.analysisCard}>
                <Text style={styles.analysisLabel}>A MI está analisando seus dados…</Text>
                <Skeleton width={260} height={14} tone="light" style={styles.gap} />
                <Skeleton width={220} height={14} tone="light" style={styles.gap} />
                <Skeleton width={240} height={14} tone="light" style={styles.gap} />
              </View>
              {Array.from({ length: 2 }, (_, index) => (
                <View key={index} style={styles.card}>
                  <Skeleton width={40} height={40} />
                  <View style={styles.texts}>
                    <Skeleton width={160} height={14} />
                    <Skeleton width={220} height={12} style={styles.gap} />
                  </View>
                </View>
              ))}
            </>
          ) : null
        ) : (
          <>
            {!data.isPreview && (
              <View style={styles.analysisCard}>
                <View style={styles.analysisHeader}>
                  <IconSparkles size={18} color={colors.primary} />
                  <Text style={styles.analysisLabel}>
                    {data.artificialInsight?.title || 'Análise da MI'}
                  </Text>
                </View>
                {data.artificialInsight ? (
                  <RichText text={data.artificialInsight.message} style={styles.analysisText} />
                ) : (
                  <Text style={styles.analysisText}>
                    A análise da MI está indisponível no momento. Tente novamente mais tarde.
                  </Text>
                )}
              </View>
            )}

            {data.insights.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  Nenhum alerta para {monthLabel}. Continue registrando suas receitas e despesas
                  para receber dicas.
                </Text>
              </View>
            ) : (
              data.insights.map((insight, index) => <InsightCard key={index} insight={insight} />)
            )}

            {data.isPreview &&
              Array.from({ length: data.lockedInsightsCount }, (_, index) => (
                <PremiumLockedCard
                  key={index}
                  // O primeiro bloqueado é a análise da IA, que a prévia nunca traz.
                  title={index === 0 ? 'Análise da MI' : 'Insight do Premium'}
                  message={index === 0 ? PREMIUM_OFFERS.insights : undefined}
                  onPress={openOffer}
                />
              ))}

            <Text style={styles.footer}>
              Dicas geradas a partir dos seus lançamentos de {monthLabel}.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InsightCard({ insight }: { insight: FinancialInsight }) {
  const appearance =
    INSIGHT_APPEARANCE[insight.type] ?? INSIGHT_APPEARANCE[InsightType.Information];
  const Icon = appearance.icon;
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel={`${insight.title}. ${insight.message}`}
    >
      <View style={[styles.iconBox, { backgroundColor: appearance.background }]}>
        <Icon size={20} color={appearance.color} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{insight.title}</Text>
        <Text style={styles.message}>{insight.message}</Text>
      </View>
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
    paddingTop: 8,
    paddingBottom: 24,
  },
  analysisCard: {
    backgroundColor: colors.beige,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  analysisLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.incomeLabel,
  },
  analysisText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 4,
  },
  gap: {
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});
