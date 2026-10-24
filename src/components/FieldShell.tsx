import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

export type FieldIcon = ComponentType<{ size?: number; color?: string }>;

type FieldShellProps = {
  label: string;
  /** Oculta o rótulo visível; o rótulo segue para a acessibilidade de quem usa o shell. */
  hideLabel?: boolean;
  /** Fundo do campo: creme (padrão, sobre telas brancas) ou branco (sobre telas creme). */
  variant?: 'cream' | 'white';
  icon?: FieldIcon;
  focused?: boolean;
  error?: string;
  children: ReactNode;
};

/**
 * Moldura comum dos campos de formulário (rótulo, caixa, ícone e mensagem de erro),
 * usada por `TextField`, `SelectField` e `DateField` para manterem o mesmo visual.
 */
export function FieldShell({
  label,
  hideLabel,
  variant = 'cream',
  icon: Icon,
  focused,
  error,
  children,
}: FieldShellProps) {
  return (
    <View>
      {!hideLabel && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.field,
          variant === 'white' && styles.fieldWhite,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        {Icon && (
          <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
            <Icon size={20} color={colors.grayMedium} />
          </View>
        )}
        {children}
      </View>
      {!!error && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

/** Estilo do texto dentro do campo (valor digitado ou selecionado). */
export const fieldTextStyle = {
  fontFamily: fonts.regular,
  fontSize: 16,
  color: colors.textPrimary,
} as const;

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cream,
    backgroundColor: colors.cream,
  },
  fieldWhite: {
    borderColor: colors.white,
    backgroundColor: colors.white,
  },
  fieldFocused: {
    borderColor: colors.primary,
  },
  fieldError: {
    borderColor: colors.expense,
  },
  icon: {
    marginRight: 12,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.expense,
    marginTop: 6,
  },
});
