import IconChevronRight from '@tabler/icons-react-native/IconChevronRight';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

type MenuRowProps = {
  label: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
  /** Texto explicativo abaixo do rótulo. */
  description?: string;
  /** Valor exibido à direita (ex.: "Real (R$)"). */
  value?: string;
  /** Destaca o valor em laranja (ex.: "Premium"). */
  valueHighlighted?: boolean;
  /** Controle à direita (ex.: `Switch`); substitui a seta. */
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  divider?: boolean;
  disabled?: boolean;
};

/** Linha de menu/configuração usada nos cards do Perfil e de Configurações. */
export function MenuRow({
  label,
  icon: Icon,
  description,
  value,
  valueHighlighted,
  right,
  onPress,
  destructive,
  divider = true,
  disabled,
}: MenuRowProps) {
  const tint = destructive ? colors.expense : colors.primary;
  const content = (
    <>
      {Icon && <Icon size={20} color={tint} />}
      <View style={styles.texts}>
        <Text style={[styles.label, destructive && styles.destructive, disabled && styles.muted]}>
          {label}
        </Text>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
      {!!value && (
        <Text style={[styles.value, valueHighlighted && styles.valueHighlighted]}>{value}</Text>
      )}
      {right}
      {onPress && !right && !destructive && (
        <IconChevronRight size={18} color={colors.grayMedium} />
      )}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, divider && styles.divider]} accessible={!right}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  pressed: {
    backgroundColor: colors.cream,
  },
  texts: {
    flex: 1,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  destructive: {
    color: colors.expense,
  },
  muted: {
    color: colors.textSecondary,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  value: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  valueHighlighted: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
});
