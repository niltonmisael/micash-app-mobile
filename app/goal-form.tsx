import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CATEGORY_COLORS,
  CategoryIcon,
  SAVINGS_GOAL_ICONS,
  SAVINGS_GOAL_ICON_KEYS,
} from '@/components/CategoryIcon';
import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SelectField } from '@/components/SelectField';
import type { SelectOption } from '@/components/SelectField';
import { Skeleton } from '@/components/Skeleton';
import { TextField } from '@/components/TextField';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import { getCategories } from '@/lib/categories';
import { createGoal, getGoal, updateGoal } from '@/lib/goals';
import { createSavingsGoal, getSavingsGoal, updateSavingsGoal } from '@/lib/savings';
import type { FinancialGoal } from '@/types/goals';
import type { SavingsGoal } from '@/types/savings';
import { centsToAmount, formatCurrency, parseCentsInput } from '@/utils/format';
import {
  currentPeriod,
  monthYearLabel,
  periodEndKey,
  periodFromDateKey,
  shiftPeriod,
  shortMonthYearLabel,
} from '@/utils/period';
import type { MonthPeriod } from '@/utils/period';
import {
  SAVINGS_GOAL_NAME_MAX_LENGTH,
  validateGoalForm,
  validateSavingsGoalForm,
} from '@/utils/validation';

type GoalKind = 'savings' | 'limit';

const KIND_OPTIONS: { key: GoalKind; label: string }[] = [
  { key: 'savings', label: 'Economia' },
  { key: 'limit', label: 'Limite de gasto' },
];

/** Meses oferecidos: o atual e os próximos 11 (a API não aceita anos anteriores ao atual). */
const MONTH_OPTIONS = 12;

/** Prazos oferecidos para metas de economia: o mês atual e os próximos 5 anos. */
const DEADLINE_OPTIONS = 60;

/** Valor da opção "Sem prazo" na lista (os meses usam `periodKey`, sempre maior que zero). */
const NO_DEADLINE = 0;

const periodKey = (period: MonthPeriod) => period.year * 12 + (period.month - 1);
const periodFromKey = (key: number): MonthPeriod => ({
  year: Math.floor(key / 12),
  month: (key % 12) + 1,
});

/**
 * Nova meta: de economia (`?type=savings`) ou limite de gasto (`?month=&year=` sugerem o mês).
 * Com `?id=`, edita o limite de gasto; com `?type=savings&id=`, a meta de economia.
 */
export default function GoalFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type?: string;
    id?: string;
    month?: string;
    year?: string;
  }>();
  const id = params.id ? Number(params.id) : undefined;
  const isEdit = id !== undefined && Number.isFinite(id);
  const isSavings = params.type === 'savings';
  const title = !isEdit ? 'Nova meta' : isSavings ? 'Editar meta' : 'Editar limite';

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
            {title}
          </Text>
        </View>

        {isEdit ? (
          isSavings ? (
            <EditSavingsGoal id={id} />
          ) : (
            <EditGoal id={id} />
          )
        ) : (
          <NewGoal
            initialKind={isSavings ? 'savings' : 'limit'}
            initialPeriod={initialPeriod(params.month, params.year)}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Mês vindo da tela de Metas; meses passados ou inválidos voltam para o mês atual. */
function initialPeriod(month?: string, year?: string): MonthPeriod {
  const now = currentPeriod();
  const requested = { month: Number(month), year: Number(year) };
  const valid =
    Number.isInteger(requested.month) &&
    requested.month >= 1 &&
    requested.month <= 12 &&
    Number.isInteger(requested.year);
  if (!valid) return now;
  const offset = periodKey(requested) - periodKey(now);
  return offset >= 0 && offset < MONTH_OPTIONS ? requested : now;
}

/** "Economia" e "Limite de gasto" alternam o formulário na mesma tela, como no protótipo. */
function NewGoal({
  initialKind,
  initialPeriod: startPeriod,
}: {
  initialKind: GoalKind;
  initialPeriod: MonthPeriod;
}) {
  const [kind, setKind] = useState<GoalKind>(initialKind);
  const kindSelector = (
    <SegmentedControl options={KIND_OPTIONS} value={kind} onChange={setKind} style={styles.kind} />
  );

  return kind === 'savings' ? (
    <SavingsGoalForm kindSelector={kindSelector} />
  ) : (
    <NewGoalForm kindSelector={kindSelector} initialPeriod={startPeriod} />
  );
}

function NewGoalForm({
  kindSelector,
  initialPeriod: startPeriod,
}: {
  kindSelector: ReactNode;
  initialPeriod: MonthPeriod;
}) {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const categories = useAuthenticatedQuery(getCategories);

  const [categoryId, setCategoryId] = useState<number>();
  const [amountCents, setAmountCents] = useState(0);
  const [monthKey, setMonthKey] = useState(periodKey(startPeriod));
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const categoryOptions: SelectOption[] = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: category.name,
    icon: <CategoryIcon icon={category.icon} color={category.color} size={36} />,
  }));
  const monthOptions: SelectOption[] = Array.from({ length: MONTH_OPTIONS }, (_, index) => {
    const period = shiftPeriod(currentPeriod(), index);
    return { value: periodKey(period), label: monthYearLabel(period) };
  });
  const noCategories = categories.data?.length === 0;

  const errors = validateGoalForm({ categoryId, amountCents });
  const fieldError = (field: keyof typeof errors) => (showErrors ? errors[field] : undefined);

  async function handleSave() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0 || categoryId === undefined) return;

    const period = periodFromKey(monthKey);
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await runAuthenticated((token) =>
        createGoal(token, {
          categoryId,
          targetAmount: centsToAmount(amountCents),
          month: period.month,
          year: period.year,
        }),
      );
      router.back();
    } catch (error) {
      if (error instanceof HandledActionError) return;
      setSubmitError(
        error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {kindSelector}

      <Text style={styles.hint}>
        Defina quanto quer gastar em uma categoria no mês. O MiCash acompanha suas despesas e avisa
        quando você passar de 80% do limite.
      </Text>

      <View style={styles.fields}>
        {categories.error ? (
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
                Você ainda não tem categorias de despesa. Cadastre uma categoria para definir um
                limite.
              </Text>
              <Pressable
                onPress={() => router.push('/category-form')}
                hitSlop={8}
                accessibilityRole="button"
              >
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
            onChange={setCategoryId}
            error={fieldError('category')}
            disabled={categories.loading || submitting}
          />
        )}

        <TextField
          label="Valor limite"
          value={amountCents > 0 ? formatCurrency(centsToAmount(amountCents)) : ''}
          onChangeText={(text) => setAmountCents(parseCentsInput(text))}
          error={fieldError('amount')}
          placeholder="R$ 0,00"
          keyboardType="number-pad"
          editable={!submitting}
        />

        <SelectField
          label="Mês"
          options={monthOptions}
          value={monthKey}
          onChange={setMonthKey}
          disabled={submitting}
        />
      </View>

      <View style={styles.spacer} />

      {!!submitError && (
        <Text style={styles.submitError} accessibilityLiveRegion="polite">
          {submitError}
        </Text>
      )}
      <PrimaryButton title="Criar limite" onPress={handleSave} loading={submitting} />
    </ScrollView>
  );
}

/** Carrega a meta real pelo id antes de exibir o formulário de edição. */
function EditGoal({ id }: { id: number }) {
  const fetchGoal = useCallback((token: string) => getGoal(token, id), [id]);
  const { data, loading, refreshing, error, retry } = useAuthenticatedQuery(fetchGoal);

  if (data) return <EditGoalForm goal={data} />;

  return (
    <View style={styles.content}>
      {error ? (
        <ErrorNotice
          message="Não foi possível carregar o limite. Ele pode ter sido excluído."
          onRetry={retry}
          retrying={loading || refreshing}
        />
      ) : (
        <View style={styles.loading}>
          <Skeleton width={120} height={14} />
          <Skeleton width={300} height={54} />
          <Skeleton width={120} height={14} />
          <Skeleton width={300} height={54} />
        </View>
      )}
    </View>
  );
}

/** A API só permite alterar o valor; categoria e mês ficam fixos. */
function EditGoalForm({ goal }: { goal: FinancialGoal }) {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const [amountCents, setAmountCents] = useState(Math.round(goal.targetAmount * 100));
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const errors = validateGoalForm({ categoryId: goal.categoryId, amountCents });

  async function handleSave() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;

    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await runAuthenticated((token) => updateGoal(token, goal.id, centsToAmount(amountCents)));
      router.back();
    } catch (error) {
      if (error instanceof HandledActionError) return;
      setSubmitError(
        error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summary}>
        <Text style={styles.summaryName}>{goal.categoryName}</Text>
        <Text style={styles.summaryPeriod}>
          {monthYearLabel({ month: goal.month, year: goal.year })}
        </Text>
      </View>

      <TextField
        label="Valor limite"
        value={amountCents > 0 ? formatCurrency(centsToAmount(amountCents)) : ''}
        onChangeText={(text) => setAmountCents(parseCentsInput(text))}
        error={showErrors ? errors.amount : undefined}
        placeholder="R$ 0,00"
        keyboardType="number-pad"
        editable={!submitting}
      />

      <View style={styles.spacer} />

      {!!submitError && (
        <Text style={styles.submitError} accessibilityLiveRegion="polite">
          {submitError}
        </Text>
      )}
      <PrimaryButton title="Salvar alterações" onPress={handleSave} loading={submitting} />
    </ScrollView>
  );
}

/** Carrega a meta de economia real pelo id antes de exibir o formulário preenchido. */
function EditSavingsGoal({ id }: { id: number }) {
  const fetchGoal = useCallback((token: string) => getSavingsGoal(token, id), [id]);
  const { data, loading, refreshing, error, retry } = useAuthenticatedQuery(fetchGoal);

  if (data) return <SavingsGoalForm goal={data} />;

  return (
    <View style={styles.content}>
      {error ? (
        <ErrorNotice
          message="Não foi possível carregar a meta. Ela pode ter sido excluída."
          onRetry={retry}
          retrying={loading || refreshing}
        />
      ) : (
        <View style={styles.loading}>
          <Skeleton width={120} height={14} />
          <Skeleton width={300} height={54} />
          <Skeleton width={120} height={14} />
          <Skeleton width={300} height={54} />
        </View>
      )}
    </View>
  );
}

/**
 * Prazos da lista: "Sem prazo" e os próximos meses. Na edição, um prazo já vencido continua
 * na lista (a API só valida o prazo quando ele muda).
 */
function deadlineOptions(current: MonthPeriod | undefined): SelectOption[] {
  const months = Array.from({ length: DEADLINE_OPTIONS }, (_, index) =>
    shiftPeriod(currentPeriod(), index),
  );
  if (current && periodKey(current) < periodKey(months[0])) months.unshift(current);
  return [
    { value: NO_DEADLINE, label: 'Sem prazo' },
    ...months.map((period) => ({ value: periodKey(period), label: shortMonthYearLabel(period) })),
  ];
}

/** Criação (com `kindSelector`) ou edição (`goal`) de uma meta de economia. */
function SavingsGoalForm({ goal, kindSelector }: { goal?: SavingsGoal; kindSelector?: ReactNode }) {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();

  const initialDeadline = goal?.deadline ? periodFromDateKey(goal.deadline) : undefined;
  const [name, setName] = useState(goal?.name ?? '');
  const [targetCents, setTargetCents] = useState(goal ? Math.round(goal.targetAmount * 100) : 0);
  const [deadlineKey, setDeadlineKey] = useState(
    initialDeadline ? periodKey(initialDeadline) : NO_DEADLINE,
  );
  const [initialCents, setInitialCents] = useState(0);
  // Ícone e cor fora das opções do app não são pré-selecionados: o usuário escolhe ao editar.
  const [icon, setIcon] = useState<string | undefined>(
    goal ? (goal.icon in SAVINGS_GOAL_ICONS ? goal.icon : undefined) : SAVINGS_GOAL_ICON_KEYS[0],
  );
  const [color, setColor] = useState<string | undefined>(
    goal ? (CATEGORY_COLORS.includes(goal.color) ? goal.color : undefined) : CATEGORY_COLORS[0],
  );
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  const errors = validateSavingsGoalForm({ name, targetCents, icon, color });
  const fieldError = (field: keyof typeof errors) => (showErrors ? errors[field] : undefined);

  async function handleSave() {
    if (submitting) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0 || !icon || !color) return;

    const data = {
      name: name.trim(),
      targetAmount: centsToAmount(targetCents),
      deadline: deadlineKey === NO_DEADLINE ? null : periodEndKey(periodFromKey(deadlineKey)),
      icon,
      color,
    };
    setSubmitError(undefined);
    setSubmitting(true);
    try {
      await runAuthenticated((token) =>
        goal
          ? updateSavingsGoal(token, goal.id, data)
          : createSavingsGoal(token, {
              ...data,
              initialAmount: initialCents > 0 ? centsToAmount(initialCents) : null,
            }),
      );
      router.back();
    } catch (error) {
      if (error instanceof HandledActionError) return;
      setSubmitError(
        error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {kindSelector}

      <View style={styles.fields}>
        <TextField
          label="Nome da meta"
          value={name}
          onChangeText={setName}
          error={fieldError('name')}
          placeholder="Ex: Viagem"
          maxLength={SAVINGS_GOAL_NAME_MAX_LENGTH}
          editable={!submitting}
        />

        <TextField
          label="Valor alvo"
          value={targetCents > 0 ? formatCurrency(centsToAmount(targetCents)) : ''}
          onChangeText={(text) => setTargetCents(parseCentsInput(text))}
          error={fieldError('target')}
          placeholder="R$ 0,00"
          keyboardType="number-pad"
          editable={!submitting}
        />

        <SelectField
          label="Prazo"
          options={deadlineOptions(initialDeadline)}
          value={deadlineKey}
          onChange={setDeadlineKey}
          disabled={submitting}
        />

        {/* "Já guardado" vira o primeiro depósito; depois da criação, só pelo histórico. */}
        {!goal && (
          <TextField
            label="Já guardado (opcional)"
            value={initialCents > 0 ? formatCurrency(centsToAmount(initialCents)) : ''}
            onChangeText={(text) => setInitialCents(parseCentsInput(text))}
            placeholder="R$ 0,00"
            keyboardType="number-pad"
            editable={!submitting}
          />
        )}

        <View>
          <Text style={styles.label}>Ícone</Text>
          <View style={styles.iconGrid} accessibilityRole="radiogroup">
            {SAVINGS_GOAL_ICON_KEYS.map((key) => {
              const Icon = SAVINGS_GOAL_ICONS[key];
              const selected = key === icon;
              return (
                <Pressable
                  key={key}
                  style={[styles.iconOption, selected && styles.iconOptionSelected]}
                  onPress={() => setIcon(key)}
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityLabel={`Ícone ${key}`}
                  accessibilityState={{ selected }}
                >
                  <Icon
                    size={22}
                    color={selected ? (color ?? colors.primary) : colors.textPrimary}
                  />
                </Pressable>
              );
            })}
          </View>
          {!!fieldError('icon') && <Text style={styles.error}>{fieldError('icon')}</Text>}
        </View>

        <View>
          <Text style={styles.label}>Cor</Text>
          <View style={styles.colorRow} accessibilityRole="radiogroup">
            {CATEGORY_COLORS.map((value) => {
              const selected = value === color;
              return (
                <Pressable
                  key={value}
                  style={[styles.colorRing, selected && { borderColor: value }]}
                  onPress={() => setColor(value)}
                  disabled={submitting}
                  hitSlop={4}
                  accessibilityRole="radio"
                  accessibilityLabel={`Cor ${value}`}
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.colorDot, { backgroundColor: value }]} />
                </Pressable>
              );
            })}
          </View>
          {!!fieldError('color') && <Text style={styles.error}>{fieldError('color')}</Text>}
        </View>
      </View>

      <View style={styles.spacer} />

      {!!submitError && (
        <Text style={styles.submitError} accessibilityLiveRegion="polite">
          {submitError}
        </Text>
      )}
      <PrimaryButton
        title={goal ? 'Salvar alterações' : 'Criar meta'}
        onPress={handleSave}
        loading={submitting}
      />
    </ScrollView>
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  loading: {
    gap: 12,
  },
  kind: {
    backgroundColor: colors.cream,
    marginBottom: 14,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  fields: {
    gap: 22,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  notice: {
    backgroundColor: colors.cream,
    borderRadius: 14,
    padding: 14,
    gap: 8,
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
  },
  summary: {
    backgroundColor: colors.cream,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
  },
  summaryName: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  summaryPeriod: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
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
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconOption: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.cream,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.beige,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.expense,
    marginTop: 8,
  },
});
