import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';

import { FieldShell, fieldTextStyle } from '@/components/FieldShell';
import type { FieldIcon } from '@/components/FieldShell';
import { colors } from '@/constants/colors';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Oculta o rótulo visível (o campo usa só o placeholder); o rótulo segue para a acessibilidade. */
  hideLabel?: boolean;
  icon?: FieldIcon;
  /** Elemento à direita do campo, como o botão de mostrar senha. */
  accessory?: ReactNode;
  error?: string;
  /** Fundo do campo: creme (padrão, sobre telas brancas) ou branco (sobre telas creme). */
  variant?: 'cream' | 'white';
};

export function TextField({
  label,
  hideLabel,
  variant,
  icon,
  accessory,
  error,
  onFocus,
  onBlur,
  style,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <FieldShell
      label={label}
      hideLabel={hideLabel}
      variant={variant}
      icon={icon}
      focused={focused}
      error={error}
    >
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.primary}
        accessibilityLabel={label}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...inputProps}
      />
      {accessory}
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  input: {
    ...fieldTextStyle,
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
});
