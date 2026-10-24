import IconArrowDownLeft from '@tabler/icons-react-native/IconArrowDownLeft';
import IconArrowUpRight from '@tabler/icons-react-native/IconArrowUpRight';
import IconChevronRight from '@tabler/icons-react-native/IconChevronRight';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

type AddTransactionSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (kind: 'income' | 'expense') => void;
};

/** Bottom sheet do botão "+": escolhe entre registrar uma receita ou uma despesa. */
export function AddTransactionSheet({ visible, onClose, onSelect }: AddTransactionSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title} accessibilityRole="header">
        O que você quer registrar?
      </Text>
      <Text style={styles.subtitle}>Escolha o tipo da transação</Text>

      <Option
        title="Nova receita"
        description="Salário, freelance, vendas..."
        icon={IconArrowDownLeft}
        tint={colors.income}
        background={colors.incomeSoft}
        onPress={() => onSelect('income')}
      />
      <Option
        title="Nova despesa"
        description="Mercado, contas, lazer..."
        icon={IconArrowUpRight}
        tint={colors.expense}
        background={colors.expenseSoft}
        onPress={() => onSelect('expense')}
      />

      <Pressable style={styles.cancel} onPress={onClose} hitSlop={8} accessibilityRole="button">
        <Text style={styles.cancelText}>Cancelar</Text>
      </Pressable>
    </BottomSheet>
  );
}

function Option({
  title,
  description,
  icon: Icon,
  tint,
  background,
  onPress,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  tint: string;
  background: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: background },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${description}`}
    >
      <View style={styles.optionIcon}>
        <Icon size={22} color={tint} />
      </View>
      <View style={styles.optionInfo}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
      <IconChevronRight size={20} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 22,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  optionDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
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
