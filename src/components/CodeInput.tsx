import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

type CodeInputProps = {
  /** Quantidade de dígitos (vem da API). */
  length: number;
  /** Só os dígitos digitados até agora. */
  value: string;
  onChange: (value: string) => void;
  /** Chamado quando todos os dígitos foram preenchidos (digitando, colando ou pelo teclado). */
  onComplete?: (value: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Código numérico em caixas individuais. Por baixo é um único `TextInput` transparente sobre as
 * caixas: o avanço entre elas, apagar voltando, colar o código inteiro, o preenchimento automático
 * do teclado (código de e-mail/SMS) e o teclado físico funcionam como em qualquer campo.
 */
export const CodeInput = forwardRef<TextInput, CodeInputProps>(function CodeInput(
  { length, value, onChange, onComplete, error, disabled, autoFocus },
  ref,
) {
  const [focused, setFocused] = useState(false);

  function handleChange(text: string) {
    // Colar "123 456" ou "Código: 123456" também funciona: ficam só os dígitos.
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length && digits !== value) onComplete?.(digits);
  }

  // A caixa ativa é a próxima a preencher (ou a última, com o código completo).
  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, index) => (
        <View
          key={index}
          style={[
            styles.box,
            focused && index === activeIndex && styles.boxActive,
            error && styles.boxError,
            disabled && styles.boxDisabled,
          ]}
        >
          <Text style={styles.digit}>{value[index] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={ref}
        style={styles.input}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        caretHidden
        selectionColor="transparent"
        accessibilityLabel={`Código de ${length} dígitos`}
        accessibilityHint="Digite ou cole o código recebido por e-mail"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  box: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.cream,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  boxError: {
    borderColor: colors.expense,
  },
  boxDisabled: {
    opacity: 0.6,
  },
  digit: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: colors.textPrimary,
  },
  // Cobre as caixas: tocar em qualquer uma foca o campo (e o toque longo oferece "Colar").
  input: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    fontSize: 1,
  },
});
