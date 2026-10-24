import IconArrowDownLeft from '@tabler/icons-react-native/IconArrowDownLeft';
import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import IconArrowUpRight from '@tabler/icons-react-native/IconArrowUpRight';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import type { ComponentType } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/CategoryIcon';
import { DateField } from '@/components/DateField';
import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SelectField } from '@/components/SelectField';
import type { SelectOption } from '@/components/SelectField';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { SessionEndedError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import { getCategories } from '@/lib/categories';
import { INCOME_CATEGORY_LABELS, createExpense, createIncome } from '@/lib/transactions';
import { IncomeCategory } from '@/types/dashboard';
import { ExpenseStatus, PaymentType } from '@/types/transactions';
import {
  centsToAmount,
  formatCurrency,
  localDateKey,
  parseCentsInput,
  toExpenseDateTime,
} from '@/utils/format';
import { validateTransactionForm } from '@/utils/validation';
import type { TransactionKind } from '@/utils/validation';

// Opções montadas a partir dos enums do backend: o valor enviado é o do enum, não a posição.
const INCOME_CATEGORY_OPTIONS: SelectOption[] = [
  IncomeCategory.Salary,
  IncomeCategory.Freelance,
  IncomeCategory.Investment,
  IncomeCategory.Commission,
  IncomeCategory.Gift,
  IncomeCategory.Other,
].map((value) => ({ value, label: INCOME_CATEGORY_LABELS[value] }));

const PAYMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: PaymentType.Pix, label: 'Pix' },
  { value: PaymentType.DebitCard, label: 'Cartão de débito' },
  { value: PaymentType.CreditCard, label: 'Cartão de crédito' },
  { value: PaymentType.Cash, label: 'Dinheiro' },
  { value: PaymentType.EletronicTransfer, label: 'Transferência' },
];

// Limites de tamanho das colunas no banco (IncomeConfiguration / ExpenseConfiguration).
const TITLE_MAX_LENGTH: Record<TransactionKind, number> = { income: 100, expense: 150 };
const DESCRIPTION_MAX_LENGTH = 500;

export default function NewTransactionScreen() {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const params = useLocalSearchParams<{ type?: string }>();
  const [kind, setKind] = useState<TransactionKind>(
    params.type === 'expense' ? 'expense' : 'income',
  );

  const today = localDateKey(new Date());
  const [title, setTitle] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [date, setDate] = useState(today);
  const [incomeCategory, setIncomeCategory] = useState<number>();
  const [chosenCategoryId, setChosenCategoryId] = useState<number>();
  // Ids existentes quando o usuário saiu para cadastrar uma categoria pelo seletor.
  const [idsBeforeCreate, setIdsBeforeCreate] = useState<number[]>();
  const [paymentType, setPaymentType] = useState<number>();
  const [expenseStatus, setExpenseStatus] = useState(ExpenseStatus.Paid);
  const [isRecurring, setIsRecurring] = useState(false);
  const [description, setDescription] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  // Categorias de despesa são criadas pelo usuário: vêm da API, não de um enum.
  const categories = useAuthenticatedQuery(getCategories);
  const categoryOptions: SelectOption[] = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: category.name,
    icon: <CategoryIcon icon={category.icon} color={category.color} size={36} />,
  }));
  // A API não devolve o id da categoria criada. Ao voltar do cadastro, a lista é recarregada e
  // a categoria nova é o único id que não existia antes; só então ela é selecionada.
  const newCategoryIds =
    idsBeforeCreate && categories.data
      ? categories.data.filter((category) => !idsBeforeCreate.includes(category.id))
      : [];
  const categoryId =
    chosenCategoryId ?? (newCategoryIds.length === 1 ? newCategoryIds[0].id : undefined);

  function openCategoryForm() {
    setIdsBeforeCreate(categories.data?.map((category) => category.id) ?? []);
    setChosenCategoryId(undefined);
    router.push('/category-form');
  }
  const noCategories = kind === 'expense' && categories.data?.length === 0;

  const isIncome = kind === 'income';
  const errors = validateTransactionForm(
    kind,
    {
      title,
      amountCents,
      date,
      category: isIncome ? incomeCategory : categoryId,
      paymentType,
    },
    today,
  );
  const fieldError = (field: keyof typeof errors) => (showErrors ? errors[field] : undefined);

  function changeKind(next: TransactionKind) {
    setKind(next);
    setShowErrors(false);
    setSubmitError(undefined);
    // Despesas não aceitam data futura; uma data futura escolhida para receita volta para hoje.
    if (next === 'expense' && date > today) setDate(today);
  }

  async function handleSave() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0 || noCategories) return;

    setSubmitError(undefined);
    setSubmitting(true);
    try {
      if (isIncome) {
        await runAuthenticated((token) =>
          createIncome(token, {
            title: title.trim(),
            description: description.trim() || null,
            amount: centsToAmount(amountCents),
            receivedAt: date,
            incomeCategory: incomeCategory as IncomeCategory,
            isRecurring,
          }),
        );
      } else {
        await runAuthenticated((token) =>
          createExpense(token, {
            title: title.trim(),
            description: description.trim(),
            expenseDate: toExpenseDateTime(date),
            amount: centsToAmount(amountCents),
            paymentType: paymentType as PaymentType,
            expenseStatus,
            categoryId: categoryId as number,
          }),
        );
      }
      router.back();
      Alert.alert(isIncome ? 'Receita registrada' : 'Despesa registrada', title.trim());
    } catch (error) {
      if (error instanceof SessionEndedError) return;
      setSubmitError(
        error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <IconArrowLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {isIncome ? 'Nova receita' : 'Nova despesa'}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.kindRow} accessibilityRole="tablist">
            <KindButton
              label="Receita"
              icon={IconArrowDownLeft}
              selected={isIncome}
              tint={colors.income}
              background={colors.incomeSoft}
              onPress={() => changeKind('income')}
            />
            <KindButton
              label="Despesa"
              icon={IconArrowUpRight}
              selected={!isIncome}
              tint={colors.expense}
              background={colors.expenseSoft}
              onPress={() => changeKind('expense')}
            />
          </View>

          <View style={styles.fields}>
            <TextField
              label="Descrição"
              value={title}
              onChangeText={setTitle}
              error={fieldError('title')}
              placeholder={isIncome ? 'Ex: Salário' : 'Ex: Mercado'}
              maxLength={TITLE_MAX_LENGTH[kind]}
              editable={!submitting}
            />

            <TextField
              label="Valor"
              value={amountCents > 0 ? formatCurrency(centsToAmount(amountCents)) : ''}
              onChangeText={(text) => setAmountCents(parseCentsInput(text))}
              error={fieldError('amount')}
              placeholder="R$ 0,00"
              keyboardType="number-pad"
              editable={!submitting}
            />

            {isIncome ? (
              <SelectField
                label="Categoria"
                options={INCOME_CATEGORY_OPTIONS}
                value={incomeCategory}
                onChange={setIncomeCategory}
                error={fieldError('category')}
                disabled={submitting}
              />
            ) : categories.error ? (
              <View>
                <Text style={styles.label}>Categoria</Text>
                <ErrorNotice
                  message="Não foi possível carregar suas categorias."
                  onRetry={categories.retry}
                  retrying={categories.loading || categories.refreshing}
                />
              </View>
            ) : noCategories ? (
              <View>
                <Text style={styles.label}>Categoria</Text>
                <View style={styles.notice}>
                  <Text style={styles.noticeText}>
                    Você ainda não tem categorias de despesa. Cadastre uma categoria para poder
                    registrar despesas.
                  </Text>
                  <Pressable onPress={openCategoryForm} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.noticeAction}>Cadastrar categoria</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <SelectField
                label="Categoria"
                placeholder={categories.loading ? 'Carregando categorias...' : 'Selecione'}
                options={categoryOptions}
                value={categoryId}
                onChange={setChosenCategoryId}
                error={fieldError('category')}
                disabled={categories.loading || submitting}
                action={{ label: 'Nova categoria', onPress: openCategoryForm }}
              />
            )}

            <DateField
              label="Data"
              value={date}
              onChange={setDate}
              maximumDate={isIncome ? undefined : new Date()}
              error={fieldError('date')}
            />

            {!isIncome && (
              <>
                <SelectField
                  label="Forma de pagamento"
                  options={PAYMENT_TYPE_OPTIONS}
                  value={paymentType}
                  onChange={setPaymentType}
                  error={fieldError('paymentType')}
                  disabled={submitting}
                />

                <View>
                  <Text style={styles.label}>Status</Text>
                  <View style={styles.statusRow} accessibilityRole="radiogroup">
                    {[
                      { value: ExpenseStatus.Paid, label: 'Pago' },
                      { value: ExpenseStatus.Pending, label: 'Pendente' },
                    ].map((option) => {
                      const selected = option.value === expenseStatus;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.statusOption, selected && styles.statusOptionSelected]}
                          onPress={() => setExpenseStatus(option.value)}
                          disabled={submitting}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <Text style={[styles.statusText, selected && styles.statusTextSelected]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {isIncome && (
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text style={styles.switchLabel}>Receita recorrente</Text>
                  <Text style={styles.switchHint}>Marque se ela se repete todo mês.</Text>
                </View>
                <Switch
                  value={isRecurring}
                  onValueChange={setIsRecurring}
                  disabled={submitting}
                  trackColor={{ true: colors.primarySoft, false: colors.border }}
                  thumbColor={isRecurring ? colors.primary : colors.white}
                  accessibilityLabel="Receita recorrente"
                />
              </View>
            )}

            <TextField
              label="Observação (opcional)"
              value={description}
              onChangeText={setDescription}
              placeholder="Adicione uma observação"
              maxLength={DESCRIPTION_MAX_LENGTH}
              editable={!submitting}
            />
          </View>

          <View style={styles.spacer} />

          {!!submitError && (
            <Text style={styles.submitError} accessibilityLiveRegion="polite">
              {submitError}
            </Text>
          )}

          <PrimaryButton
            title="Salvar"
            onPress={handleSave}
            loading={submitting}
            disabled={noCategories}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function KindButton({
  label,
  icon: Icon,
  selected,
  tint,
  background,
  onPress,
}: {
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  selected: boolean;
  tint: string;
  background: string;
  onPress: () => void;
}) {
  const color = selected ? tint : colors.textSecondary;
  return (
    <Pressable
      style={[styles.kindButton, selected && { backgroundColor: background, borderColor: tint }]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
    >
      <Icon size={18} color={color} />
      <Text style={[styles.kindText, { color }, selected && styles.kindTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  kindButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grayLight,
    backgroundColor: colors.grayLight,
  },
  kindText: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  kindTextSelected: {
    fontFamily: fonts.semiBold,
  },
  fields: {
    gap: 18,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  notice: {
    borderRadius: 14,
    backgroundColor: colors.cream,
    padding: 16,
  },
  noticeText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  noticeAction: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
    marginTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusOption: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cream,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOptionSelected: {
    backgroundColor: colors.beige,
    borderColor: colors.primarySoft,
  },
  statusText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
  },
  statusTextSelected: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: colors.cream,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  switchLabel: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  switchHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  spacer: {
    flex: 1,
    minHeight: 28,
  },
  submitError: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.expense,
    textAlign: 'center',
    marginBottom: 12,
  },
});
