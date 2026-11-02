import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressBar } from '@/components/ProgressBar';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { GoalStatus } from '@/types/goals';
import type { GoalLimit } from '@/types/goals';
import { formatCurrency } from '@/utils/format';

/** Verde até 80%, laranja de 80% a 100% e vermelho ao estourar (mesmas faixas da API). */
export function goalStatusColor(status: GoalStatus): string {
  if (status === GoalStatus.Exceeded) return colors.expense;
  if (status === GoalStatus.Warning) return colors.primary;
  return colors.income;
}

/** "Restam R$ 150,00", "Limite atingido" ou "Passou R$ 10,00". */
export function goalRemainingLabel(limit: GoalLimit): string {
  if (limit.remainingAmount > 0) return `Restam ${formatCurrency(limit.remainingAmount)}`;
  if (limit.remainingAmount === 0) return 'Limite atingido';
  return `Passou ${formatCurrency(-limit.remainingAmount)}`;
}

type GoalLimitRowProps = {
  limit: GoalLimit;
  onPress?: () => void;
  divider?: boolean;
};

/** Limite de gasto de uma categoria: gasto/limite, quanto resta e barra de progresso. */
export function GoalLimitRow({ limit, onPress, divider }: GoalLimitRowProps) {
  const tint = goalStatusColor(limit.status);
  const amounts = `${formatCurrency(limit.currentAmount)} de ${formatCurrency(limit.targetAmount)}`;
  const remaining = goalRemainingLabel(limit);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${limit.name}: ${amounts}. ${remaining}`}
    >
      <View style={styles.top}>
        <CategoryIcon icon={limit.icon} color={limit.color} />
        <View style={styles.texts}>
          <Text style={styles.name} numberOfLines={1}>
            {limit.name}
          </Text>
          <Text style={styles.amounts} numberOfLines={1}>
            {amounts}
          </Text>
        </View>
        <Text style={[styles.remaining, { color: tint }]}>{remaining}</Text>
      </View>
      <ProgressBar value={limit.percentageUsed} color={tint} style={styles.bar} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  pressed: {
    backgroundColor: colors.cream,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  texts: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  amounts: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  remaining: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  bar: {
    marginTop: 12,
  },
});
