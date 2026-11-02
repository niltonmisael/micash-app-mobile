import IconCheck from '@tabler/icons-react-native/IconCheck';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon, categoryDisplayColor } from '@/components/CategoryIcon';
import { ProgressBar } from '@/components/ProgressBar';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import type { SavingsGoalSummary } from '@/types/savings';
import { formatCurrency } from '@/utils/format';
import { periodFromDateKey, shortMonthYearLabel } from '@/utils/period';

/** "dez/2026" ou "Sem prazo". */
export function savingsDeadlineLabel(deadline: string | null): string {
  return deadline ? shortMonthYearLabel(periodFromDateKey(deadline)) : 'Sem prazo';
}

/**
 * Percentual inteiro, arredondado para baixo: 99,6% ainda não é "100%". Acima de 100 continua
 * aparecendo (o guardado pode passar do alvo).
 */
export function savingsPercentLabel(percentage: number): string {
  return `${Math.floor(Math.max(percentage, 0))}%`;
}

/** Cor da meta; concluída fica verde. */
export function savingsGoalTint(goal: Pick<SavingsGoalSummary, 'color' | 'isCompleted'>): string {
  return goal.isCompleted ? colors.income : categoryDisplayColor(goal.color);
}

type SavingsGoalRowProps = {
  goal: SavingsGoalSummary;
  onPress?: () => void;
};

/** Meta de economia: guardado/alvo, prazo, percentual (ou "Concluída") e barra de progresso. */
export function SavingsGoalRow({ goal, onPress }: SavingsGoalRowProps) {
  const tint = savingsGoalTint(goal);
  const amounts = `${formatCurrency(goal.savedAmount)} de ${formatCurrency(goal.targetAmount)}`;
  const deadline = goal.deadline
    ? `até ${savingsDeadlineLabel(goal.deadline)}`
    : savingsDeadlineLabel(null).toLowerCase();
  const status = goal.isCompleted ? 'Concluída' : savingsPercentLabel(goal.percentage);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${goal.name}: ${amounts}, ${deadline}. ${status}`}
    >
      <View style={styles.top}>
        {goal.isCompleted ? (
          <View style={styles.completedIcon}>
            <IconCheck size={18} color={colors.income} />
          </View>
        ) : (
          <CategoryIcon icon={goal.icon} color={goal.color} />
        )}
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={2}>
            {goal.name}
          </Text>
          <Text style={styles.details}>
            {amounts} · {deadline}
          </Text>
        </View>
        {goal.isCompleted ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{status}</Text>
          </View>
        ) : (
          <Text style={[styles.percent, { color: tint }]}>{status}</Text>
        )}
      </View>
      <ProgressBar value={goal.percentage} color={tint} style={styles.bar} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  pressed: {
    backgroundColor: colors.cream,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  completedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.incomeSoft,
  },
  texts: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  details: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  percent: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.incomeSoft,
  },
  badgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.income,
  },
  bar: {
    marginTop: 12,
  },
});
