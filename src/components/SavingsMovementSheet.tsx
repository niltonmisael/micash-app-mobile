import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { DateField } from '@/components/DateField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { ApiError } from '@/lib/api';
import { registerSavingsMovement } from '@/lib/savings';
import { SavingsMovementType } from '@/types/savings';
import { centsToAmount, formatCurrency, localDateKey, parseCentsInput } from '@/utils/format';
import { validateSavingsMovementForm } from '@/utils/validation';

/** Atalhos que somam ao valor digitado, em centavos. */
const QUICK_AMOUNTS = [5000, 10000, 20000];

type SavingsMovementSheetProps = {
  /** `undefined` fecha a janela. */
  type?: SavingsMovementType;
  goalId: number;
  goalName: string;
  /** Valor guardado: limite da retirada. */
  savedAmount: number;
  onClose: () => void;
  /** Chamado depois que a API registrou o movimento. */
  onDone: () => void;
};

/** "Guardar dinheiro" (depósito) ou "Retirar dinheiro" de uma meta de economia. */
export function SavingsMovementSheet({ type, onClose, ...props }: SavingsMovementSheetProps) {
  return (
    <BottomSheet visible={type !== undefined} onClose={onClose}>
      {/* O conteúdo só existe com a janela aberta: cada abertura começa com o formulário limpo. */}
      {type !== undefined && <MovementForm type={type} {...props} />}
    </BottomSheet>
  );
}

function MovementForm({
  type,
  goalId,
  goalName,
  savedAmount,
  onDone,
}: Omit<SavingsMovementSheetProps, 'type' | 'onClose'> & { type: SavingsMovementType }) {
  const runAuthenticated = useAuthenticatedAction();
  const isDeposit = type === SavingsMovementType.Deposit;
  const today = localDateKey(new Date());

  const [amountCents, setAmountCents] = useState(0);
  const [date, setDate] = useState(today);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const errors = validateSavingsMovementForm(
    {
      amountCents,
      date,
      maxCents: isDeposit ? undefined : Math.round(savedAmount * 100),
    },
    today,
  );

  async function handleSave() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;

    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await runAuthenticated((token) =>
        registerSavingsMovement(token, goalId, type, {
          amount: centsToAmount(amountCents),
          date,
        }),
      );
      onDone();
    } catch (error) {
      if (error instanceof HandledActionError) return;
      setSubmitError(
        error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  // "R$ 1.234,56" → "1.234,56": o "R$" fica em um texto menor ao lado, como no protótipo.
  const amountText = amountCents > 0 ? formatCurrency(centsToAmount(amountCents)).slice(3) : '';
  const amountError = showErrors ? errors.amount : undefined;

  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        {isDeposit ? 'Guardar dinheiro' : 'Retirar dinheiro'}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {isDeposit ? `Meta: ${goalName}` : `Guardado: ${formatCurrency(savedAmount)}`}
      </Text>

      <View style={styles.amountRow}>
        <Text style={styles.currency}>R$</Text>
        <TextInput
          style={styles.amountInput}
          value={amountText}
          onChangeText={(text) => setAmountCents(parseCentsInput(text))}
          placeholder="0,00"
          placeholderTextColor={colors.grayInactive}
          selectionColor={colors.primary}
          keyboardType="number-pad"
          editable={!submitting}
          accessibilityLabel="Valor"
        />
      </View>
      {!!amountError && <Text style={styles.fieldError}>{amountError}</Text>}

      {isDeposit && (
        <View style={styles.chips}>
          {QUICK_AMOUNTS.map((cents) => (
            <Pressable
              key={cents}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={() => setAmountCents((current) => current + cents)}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={`Somar ${formatCurrency(centsToAmount(cents))}`}
            >
              <Text style={styles.chipText}>+ R$ {cents / 100}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.date}>
        <DateField
          label="Data"
          value={date}
          onChange={setDate}
          maximumDate={new Date()}
          error={showErrors ? errors.date : undefined}
        />
      </View>

      {!!submitError && (
        <Text style={styles.submitError} accessibilityLiveRegion="polite">
          {submitError}
        </Text>
      )}
      <PrimaryButton
        title={isDeposit ? 'Guardar' : 'Retirar'}
        onPress={handleSave}
        loading={submitting}
      />
      {isDeposit && <Text style={styles.footnote}>Para retirar, use o menu ··· da meta</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  currency: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: colors.primary,
  },
  amountInput: {
    minWidth: 120,
    fontFamily: fonts.semiBold,
    fontSize: 40,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  fieldError: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.expense,
    textAlign: 'center',
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.beige,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
  },
  date: {
    marginTop: 20,
    marginBottom: 20,
  },
  submitError: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.expense,
    textAlign: 'center',
    marginBottom: 12,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 14,
  },
});
