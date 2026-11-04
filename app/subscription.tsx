import IconCheck from '@tabler/icons-react-native/IconCheck';
import IconCrown from '@tabler/icons-react-native/IconCrown';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { FREE_BENEFITS, PREMIUM_BENEFITS } from '@/constants/plans';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { usePlan } from '@/hooks/usePlan';
import { ApiError } from '@/lib/api';
import {
  annualDiscountPercent,
  cancelSubscription,
  createCheckout,
  getSubscriptionData,
  isFreePlan,
  plansByCycle,
  premiumAccessUntil,
  reactivateSubscription,
} from '@/lib/subscription';
import type { BillingCycle } from '@/lib/subscription';
import { SubscriptionStatus } from '@/types/user';
import type { Plan } from '@/types/user';
import { formatCurrency, formatDate, toDateKey } from '@/utils/format';

const UNEXPECTED_ERROR = 'Ocorreu um erro inesperado. Tente novamente.';

const CYCLE_SUFFIX: Record<BillingCycle, string> = { monthly: '/mês', annual: '/ano' };

type PendingAction = 'checkout' | 'cancel' | 'reactivate';

/** Data UTC da API como "12 dez 2026". */
function formatApiDate(value: string): string {
  return formatDate(toDateKey(value));
}

export default function SubscriptionScreen() {
  const runAuthenticated = useAuthenticatedAction();
  const { data, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(getSubscriptionData);
  const { reloadLimits } = usePlan();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [pending, setPending] = useState<PendingAction>();

  // Ao sair da tela (ex.: depois de assinar), os limites são relidos e os cadeados somem.
  useEffect(() => () => void reloadLimits(), [reloadLimits]);

  const current = data?.current;
  const plans = plansByCycle(data?.plans ?? []);
  // `current` só traz assinatura ativa ou pendente (checkout aguardando o pagamento).
  const premium =
    current && !isFreePlan(current) && current.status === SubscriptionStatus.Active
      ? current
      : undefined;
  const paymentPending =
    !!current && !isFreePlan(current) && current.status === SubscriptionStatus.Pending;

  const cycles = (['monthly', 'annual'] as const).filter((key) => plans[key]);
  const selectedCycle = plans[cycle] ? cycle : cycles[0];
  const selectedPlan = selectedCycle ? plans[selectedCycle] : undefined;
  const discount =
    plans.monthly && plans.annual ? annualDiscountPercent(plans.monthly, plans.annual) : 0;
  const accessUntil = premium ? premiumAccessUntil(premium) : null;
  const accessUntilLabel = accessUntil ? formatApiDate(accessUntil) : 'o fim do período pago';
  const premiumCycle = (Object.keys(plans) as BillingCycle[]).find(
    (key) => plans[key]?.id === premium?.planId,
  );

  async function run(action: PendingAction, task: (token: string) => Promise<void>) {
    setPending(action);
    try {
      await runAuthenticated(task);
      return true;
    } catch (err) {
      if (!(err instanceof HandledActionError)) {
        Alert.alert(
          action === 'checkout'
            ? 'Não foi possível iniciar a assinatura'
            : 'Não foi possível atualizar a assinatura',
          err instanceof ApiError ? err.message : UNEXPECTED_ERROR,
        );
      }
      return false;
    } finally {
      setPending(undefined);
    }
  }

  async function subscribe(plan: Plan) {
    await run('checkout', async (token) => {
      const url = await createCheckout(token, plan.id);
      // O pagamento acontece no Pagar.me; a assinatura só muda depois da confirmação do
      // pagamento no backend (webhook). Ao voltar ao app, a tela recarrega o status.
      await Linking.openURL(url);
    });
  }

  async function afterChange() {
    await Promise.all([refresh(), reloadLimits()]);
  }

  function confirmCancel() {
    Alert.alert(
      'Cancelar assinatura?',
      `Você continua com o Premium até ${accessUntilLabel}. Depois disso, sua conta volta para o plano Gratuito.`,
      [
        { text: 'Manter Premium', style: 'cancel' },
        {
          text: 'Cancelar assinatura',
          style: 'destructive',
          onPress: async () => {
            if (await run('cancel', cancelSubscription)) await afterChange();
          },
        },
      ],
    );
  }

  async function reactivate() {
    if (await run('reactivate', reactivateSubscription)) {
      await afterChange();
      Alert.alert('Assinatura reativada', 'Seu Premium continua renovando normalmente.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Assinatura" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.title} accessibilityRole="header">
          {premium ? 'Seu plano' : 'Escolha seu plano'}
        </Text>

        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        {!data ? (
          loading && (
            <View style={styles.loading}>
              <Skeleton width={320} height={48} />
              <Skeleton width={320} height={180} />
              <Skeleton width={320} height={220} />
            </View>
          )
        ) : premium ? (
          <>
            <View style={[styles.card, styles.cardPremium]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{premium.planName}</Text>
                <IconCrown size={22} color={colors.primary} />
              </View>
              <Price value={premium.price} suffix={premiumCycle && CYCLE_SUFFIX[premiumCycle]} />
              <BenefitList items={PREMIUM_BENEFITS} />

              {premium.cancelAtPeriodEnd ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeTitle}>Cancelamento agendado</Text>
                  <Text style={styles.noticeText}>
                    Seu Premium continua até {accessUntilLabel}. Depois disso, sua conta volta para
                    o plano Gratuito.
                  </Text>
                </View>
              ) : (
                premium.nextBillingDate && (
                  <Text style={styles.detail}>
                    Próxima cobrança em {formatApiDate(premium.nextBillingDate)}
                  </Text>
                )
              )}

              {premium.cancelAtPeriodEnd ? (
                <PrimaryButton
                  title="Reativar assinatura"
                  onPress={reactivate}
                  loading={pending === 'reactivate'}
                  disabled={pending !== undefined}
                  style={styles.button}
                />
              ) : (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Plano atual</Text>
                </View>
              )}
            </View>

            {!premium.cancelAtPeriodEnd && (
              <Pressable
                style={styles.cancelLink}
                onPress={confirmCancel}
                disabled={pending !== undefined}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.cancelLinkText}>
                  {pending === 'cancel' ? 'Cancelando…' : 'Cancelar assinatura'}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            {cycles.length > 1 && (
              <SegmentedControl
                options={cycles.map((key) => ({
                  key,
                  label:
                    key === 'monthly' ? 'Mensal' : discount ? `Anual (${discount}% OFF)` : 'Anual',
                }))}
                value={selectedCycle!}
                onChange={setCycle}
                style={styles.cycles}
              />
            )}

            {paymentPending && (
              <View style={[styles.notice, styles.noticeTop]}>
                <Text style={styles.noticeTitle}>Pagamento pendente</Text>
                <Text style={styles.noticeText}>
                  Assim que o Pagar.me confirmar o pagamento, seu Premium é ativado. Puxe a tela
                  para atualizar.
                </Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.planName}>Gratuito</Text>
              <Price value={0} suffix="/mês" />
              <BenefitList items={FREE_BENEFITS} />
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Plano atual</Text>
              </View>
            </View>

            {/* O Premium aparece mesmo sem plano na API: os benefícios continuam visíveis. */}
            <View style={[styles.card, styles.cardPremium]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Premium</Text>
                <IconCrown size={22} color={colors.primary} />
              </View>
              {selectedPlan && (
                <Price value={selectedPlan.price} suffix={CYCLE_SUFFIX[selectedCycle!]} />
              )}
              <BenefitList items={PREMIUM_BENEFITS} />
              <PrimaryButton
                title={selectedPlan ? 'Assinar agora' : 'Assinatura indisponível no momento'}
                onPress={() => selectedPlan && subscribe(selectedPlan)}
                loading={pending === 'checkout'}
                disabled={!selectedPlan || pending !== undefined}
                style={styles.button}
              />
            </View>

            {!!selectedPlan && (
              <>
                <Text style={styles.footnote}>Cancele quando quiser.</Text>
                <Text style={styles.footnote}>
                  O pagamento é feito no Pagar.me. Sua assinatura é ativada depois da confirmação do
                  pagamento.
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Price({ value, suffix }: { value: number; suffix?: string }) {
  return (
    <Text style={styles.price}>
      {formatCurrency(value)}
      {!!suffix && <Text style={styles.priceSuffix}> {suffix}</Text>}
    </Text>
  );
}

function BenefitList({ items }: { items: string[] }) {
  return (
    <View style={styles.benefits}>
      {items.map((item) => (
        <View key={item} style={styles.benefit}>
          <IconCheck size={16} color={colors.primary} />
          <Text style={styles.benefitText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 18,
  },
  loading: {
    gap: 14,
  },
  cycles: {
    marginBottom: 14,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  cardPremium: {
    borderColor: colors.primary,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planName: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  price: {
    fontFamily: fonts.semiBold,
    fontSize: 26,
    color: colors.textPrimary,
    marginTop: 4,
  },
  priceSuffix: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  detail: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
  },
  benefits: {
    gap: 8,
    marginTop: 12,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  notice: {
    backgroundColor: colors.beige,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    gap: 2,
  },
  noticeTop: {
    marginTop: 0,
    marginBottom: 14,
  },
  noticeTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  noticeText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  currentBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.grayLight,
    marginTop: 14,
  },
  currentBadgeText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  button: {
    marginTop: 14,
  },
  cancelLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  cancelLinkText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.expense,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
});
