import IconCheck from '@tabler/icons-react-native/IconCheck';
import IconChevronDown from '@tabler/icons-react-native/IconChevronDown';
import IconPlus from '@tabler/icons-react-native/IconPlus';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { FieldShell, fieldTextStyle } from '@/components/FieldShell';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

export type SelectOption = {
  /** Valor enviado à API (valor do enum ou id), nunca a posição na lista. */
  value: number;
  label: string;
  /** Elemento à esquerda do nome (ex.: ícone da categoria). */
  icon?: ReactNode;
};

type SelectFieldProps = {
  label: string;
  placeholder?: string;
  options: SelectOption[];
  value?: number;
  onChange: (value: number) => void;
  error?: string;
  disabled?: boolean;
  /** Ação destacada no topo da lista (ex.: "Nova categoria"); fecha a lista ao ser tocada. */
  action?: { label: string; onPress: () => void };
};

/** Campo de seleção com o visual do `TextField`; as opções abrem em uma janela inferior. */
export function SelectField({
  label,
  placeholder = 'Selecione',
  options,
  value,
  onChange,
  error,
  disabled,
  action,
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  function choose(next: number) {
    onChange(next);
    setOpen(false);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'nenhuma opção selecionada'}`}
        accessibilityState={{ disabled, expanded: open }}
      >
        <FieldShell label={label} focused={open} error={error}>
          {selected?.icon && <View style={styles.fieldIcon}>{selected.icon}</View>}
          <Text
            style={[styles.value, (!selected || disabled) && styles.placeholder]}
            numberOfLines={1}
          >
            {selected?.label ?? placeholder}
          </Text>
          <IconChevronDown size={20} color={colors.grayMedium} />
        </FieldShell>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.title} accessibilityRole="header">
          {label}
        </Text>
        {action && (
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            onPress={() => {
              setOpen(false);
              action.onPress();
            }}
            accessibilityRole="button"
          >
            <View style={styles.actionIcon}>
              <IconPlus size={20} color={colors.white} />
            </View>
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        )}
        <ScrollView style={styles.list}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => choose(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                {option.icon && <View style={styles.optionIcon}>{option.icon}</View>}
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
                {isSelected ? (
                  <IconCheck size={22} color={colors.primary} />
                ) : (
                  <View style={styles.radio} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  value: {
    ...fieldTextStyle,
    flex: 1,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  fieldIcon: {
    marginRight: 10,
  },
  optionIcon: {
    marginRight: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.grayMedium,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primarySoft,
    backgroundColor: colors.beige,
  },
  actionPressed: {
    opacity: 0.85,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  actionText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.primary,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  list: {
    marginBottom: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
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
