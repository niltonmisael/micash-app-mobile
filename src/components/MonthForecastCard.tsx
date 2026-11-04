import IconAlertTriangle from '@tabler/icons-react-native/IconAlertTriangle';
import IconChartLine from '@tabler/icons-react-native/IconChartLine';
import IconCrown from '@tabler/icons-react-native/IconCrown';
import IconLock from '@tabler/icons-react-native/IconLock';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { type DashboardForecast, forecastGoalsAtRisk } from '@/lib/dashboard';
import type { GoalForecast, MonthForecast } from '@/types/dashboard';
import { formatCurrency } from '@/utils/format';

type MonthForecastCardProps = {
  /** `undefined` enquanto carrega; `null` quando a previsão não pôde ser carregada. */
  forecast: DashboardForecast | null | undefined;
  /** Esconde o saldo previsto quando o saldo do Dashboard está oculto. */
  hideBalance: boolean;
  hiddenValue: string;
  /** Card bloqueado (sem assinatura): abre a tela de assinatura. */
  onUnlock: () => void;
};

/** Card "Previsão do mês" do Dashboard (Premium). Todos os valores vêm prontos da API. */
export function MonthForecastCard({
  forecast,
  hideBalance,
  hiddenValue,
  onUnlock,
}: MonthForecastCardProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Previsão do mês</Text>
        <View style={styles.premiumBadge}>
          <IconCrown size={14} color={colors.primary} />
          <Text style={styles.premiumText}>Premium</Text>
        </View>
      </View>
      {forecast === undefined ? (
        <View style={styles.card}>
          <Skeleton width={200} height={14} />
          <Skeleton width={160} height={26} style={styles.skeletonGap} />
          <Skeleton width={230} height={12} style={styles.skeletonGap} />
        </View>
      ) : forecast === null ? (
        <View style={styles.card}>
          <Text style={styles.muted}>Previsão indisponível no momento.</Text>
        </View>
      ) : forecast === 'locked' ? (
        <LockedForecast onPress={onUnlock} />
      ) : !forecast.isReliable ? (
        <View style={[styles.card, styles.rowCard]}>
          <IconChartLine size={22} color={colors.primary} />
          <Text style={[styles.muted, styles.flex]}>
            Lance mais alguns gastos para ver sua previsão
          </Text>
        </View>
      ) : (
        <ReliableForecast forecast={forecast} hideBalance={hideBalance} hiddenValue={hiddenValue} />
      )}
    </View>
  );
}

function ReliableForecast({
  forecast,
  hideBalance,
  hiddenValue,
}: {
  forecast: MonthForecast;
  hideBalance: boolean;
  hiddenValue: string;
}) {
  const negative = forecast.projectedBalance < 0;
  const value = hideBalance ? hiddenValue : formatCurrency(Math.abs(forecast.projectedBalance));
  const headline = negative
    ? { before: 'No ritmo atual, faltam', after: 'no fim do mês' }
    : { before: 'No ritmo atual, você termina o mês com', after: undefined };
  const atRisk = forecastGoalsAtRisk(forecast.goals);
  const secondary = `Gasto previsto: ${formatCurrency(forecast.projectedExpense)} · média de ${formatCurrency(forecast.dailyExpenseRate)}/dia`;

  return (
    <View style={[styles.card, negative && styles.cardAlert]}>
      <View
        accessible
        accessibilityLabel={[headline.before, value, headline.after].filter(Boolean).join(' ')}
      >
        <View style={styles.headlineRow}>
          {negative && <IconAlertTriangle size={18} color={colors.expense} />}
          <Text style={[styles.headline, negative && styles.alertText]}>{headline.before}</Text>
        </View>
        <Text
          style={[styles.value, negative && styles.alertText]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {headline.after && (
          <Text style={[styles.headline, styles.alertText]}>{headline.after}</Text>
        )}
      </View>
      <Text style={styles.secondary}>{secondary}</Text>

      {atRisk.length > 0 ? (
        <View style={[styles.goals, negative && styles.goalsAlert]}>
          {atRisk.map((goal) => (
            <View key={goal.categoryId} style={styles.goalRow}>
              <View style={[styles.goalDot, goal.alreadyExceeded && styles.goalDotExceeded]} />
              <Text style={styles.goalText}>{goalRiskText(goal)}</Text>
            </View>
          ))}
        </View>
      ) : forecast.goals.length > 0 ? (
        <Text style={[styles.secondary, styles.goalsOk]}>Suas metas estão dentro do previsto.</Text>
      ) : null}
    </View>
  );
}

function goalRiskText(goal: GoalForecast): string {
  if (goal.alreadyExceeded) return `${goal.categoryName} já passou da meta`;
  return goal.estimatedExceedDay !== null
    ? `${goal.categoryName} deve estourar por volta do dia ${goal.estimatedExceedDay}`
    : `${goal.categoryName} deve estourar até o fim do mês`;
}

/** Teaser para quem não tem assinatura: conteúdo esmaecido com cadeado. */
function LockedForecast({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.lockedCard, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Previsão do mês, recurso Premium. A previsão do fim do mês faz parte do plano Premium"
    >
      <View style={styles.placeholder} importantForAccessibility="no-hide-descendants">
        <View style={[styles.placeholderLine, { width: '70%' }]} />
        <View style={[styles.placeholderLine, styles.placeholderValue]} />
        <View style={[styles.placeholderLine, { width: '85%' }]} />
      </View>
      <View style={styles.lockOverlay}>
        <View style={styles.lockIcon}>
          <IconLock size={20} color={colors.primary} />
        </View>
        <Text style={styles.lockText}>A previsão do fim do mês faz parte do plano Premium</Text>
        <Text style={styles.lockAction}>Ver meu plano</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.beige,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  premiumText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
  },
  cardAlert: {
    backgroundColor: colors.expenseSoft,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  skeletonGap: {
    marginTop: 10,
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headline: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  alertText: {
    color: colors.expense,
  },
  value: {
    fontFamily: fonts.medium,
    fontSize: 26,
    color: colors.textPrimary,
    marginVertical: 2,
  },
  secondary: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
  goals: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  goalsAlert: {
    borderTopColor: colors.white,
  },
  goalsOk: {
    marginTop: 12,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  goalDotExceeded: {
    backgroundColor: colors.expense,
  },
  goalText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  lockedCard: {
    minHeight: 150,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  placeholder: {
    gap: 12,
    opacity: 0.5,
  },
  placeholderLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.grayLight,
  },
  placeholderValue: {
    width: '50%',
    height: 26,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    backgroundColor: colors.veil,
  },
  lockIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  lockAction: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
  },
});
