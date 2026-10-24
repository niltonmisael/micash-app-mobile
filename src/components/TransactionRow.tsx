import IconBriefcase from '@tabler/icons-react-native/IconBriefcase';
import IconCode from '@tabler/icons-react-native/IconCode';
import IconGift from '@tabler/icons-react-native/IconGift';
import IconPercentage from '@tabler/icons-react-native/IconPercentage';
import IconReceipt from '@tabler/icons-react-native/IconReceipt';
import IconTag from '@tabler/icons-react-native/IconTag';
import IconTrendingUp from '@tabler/icons-react-native/IconTrendingUp';
import type { ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { IncomeCategory } from '@/types/dashboard';
import type { Transaction } from '@/types/dashboard';
import { formatCurrency, formatDate, formatRelativeDate } from '@/utils/format';

type Icon = ComponentType<{ size?: number; color?: string }>;

const INCOME_ICONS: Record<IncomeCategory, Icon> = {
  [IncomeCategory.Salary]: IconBriefcase,
  [IncomeCategory.Freelance]: IconCode,
  [IncomeCategory.Investment]: IconTrendingUp,
  [IncomeCategory.Commission]: IconPercentage,
  [IncomeCategory.Gift]: IconGift,
  [IncomeCategory.Other]: IconTag,
};

type TransactionRowProps = {
  transaction: Transaction;
  /** O que aparece abaixo do título: a categoria (padrão) ou a data. */
  subtitle?: 'category' | 'date';
  /** Mostra a data relativa (Hoje/Ontem/...) à direita, abaixo do valor. */
  showDate?: boolean;
  /** Mostra o sinal +/− no valor. */
  showSign?: boolean;
  divider?: boolean;
};

export function TransactionRow({
  transaction,
  subtitle = 'category',
  showDate = false,
  showSign = true,
  divider = true,
}: TransactionRowProps) {
  const isIncome = transaction.kind === 'income';
  // A API não devolve o ícone da categoria de despesas; usa um ícone genérico.
  const Icon =
    (isIncome && transaction.incomeCategory !== undefined
      ? INCOME_ICONS[transaction.incomeCategory]
      : undefined) ?? (isIncome ? IconBriefcase : IconReceipt);
  const sign = showSign ? (isIncome ? '+' : '-') : '';
  const amount = `${sign}${formatCurrency(transaction.amount)}`;
  const subtitleText = subtitle === 'date' ? formatDate(transaction.date) : transaction.category;

  return (
    <View
      style={[styles.row, divider && styles.divider]}
      accessible
      accessibilityLabel={`${isIncome ? 'Receita' : 'Despesa'}: ${transaction.title}, ${transaction.category}, ${amount}, ${formatRelativeDate(transaction.date)}`}
    >
      <View style={[styles.icon, isIncome ? styles.iconIncome : styles.iconExpense]}>
        <Icon size={18} color={isIncome ? colors.income : colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {transaction.title}
        </Text>
        <Text style={styles.secondary} numberOfLines={1}>
          {subtitleText}
        </Text>
      </View>
      <View style={styles.values}>
        <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>
          {amount}
        </Text>
        {showDate && <Text style={styles.secondary}>{formatRelativeDate(transaction.date)}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconIncome: {
    backgroundColor: colors.incomeSoft,
  },
  iconExpense: {
    backgroundColor: colors.beige,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  secondary: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  values: {
    alignItems: 'flex-end',
  },
  amount: {
    fontFamily: fonts.medium,
    fontSize: 15,
  },
});
