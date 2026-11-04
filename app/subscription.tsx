import IconCheck from '@tabler/icons-react-native/IconCheck';
import IconCrown from '@tabler/icons-react-native/IconCrown';
import { useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { FREE_BENEFITS, PREMIUM_BENEFITS } from '@/constants/plans';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { usePlan } from '@/hooks/usePlan';
import { ApiError } from '@/lib/api';
import {
  billingPeriodSuffix,
  cancelSubscription,
  getCurrentSubscription,
  isFreePlan,
  isInPaymentGrace,
  premiumAccessUntil,
  reactivateSubscription,
} from '@/lib/subscription';
import { SubscriptionStatus } from '@/types/user';
import { formatCurrency, formatDate, toDateKey } from '@/utils/format';

const UNEXPECTED_ERROR = 'Ocorreu um erro inesperado. Tente novamente.';

type PendingAction = 'cancel' | 'reactivate';

/** Data UTC da API como "12 dez 2026". */
function formatApiDate(value: string): string {
  return formatDate(toDateKey(value));
}

/**
 * Meu plano: só mostra o que a API diz da assinatura. O app não vende assinaturas (não há preço de
 * venda, checkout nem convite para assinar); quem já assinou tem o Premium liberado aqui
 * automaticamente. Cancelar e reativar uma assinatura existente continuam disponíveis.
 */
export default function SubscriptionScreen() {
  const runAuthenticated = useAuthenticatedAction();
  const { data, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(getCurrentSubscription);
  const { reloadLimits } = usePlan();
  const [pending, setPending] = useState<PendingAction>();

  // Ao sair da tela, os limites são relidos (ex.: o Premium foi liberado enquanto ela estava aberta).
  useEffect(() => () => void reloadLimits(), [reloadLimits]);

  const premium = data && !isFreePlan(data) && data.isPremium ? data : undefined;
  const inGrace = !!premium && isInPaymentGrace(premium);
  // Cancelar e reativar só valem para uma assinatura ativa (a API recusa nos outros estados).
  const active = premium?.status === SubscriptionStatus.Active;
  const paymentPending =
    !!data && !isFreePlan(data) && !data.isPremium && data.status === SubscriptionStatus.Pending;
  const accessUntil = premium ? premiumAccessUntil(premium) : null;
  const accessUntilLabel = accessUntil ? formatApiDate(accessUntil) : 'o fim do período pago';

  async function run(task: (token: string) => Promise<void>, action: PendingAction) {
    setPending(action);
    try {
      await runAuthenticated(task);
      return true;
    } catch (err) {
      if (!(err instanceof HandledActionError)) {
        Alert.alert(
          'Não foi possível atualizar a assinatura',
          err instanceof ApiError ? err.message : UNEXPECTED_ERROR,
        );
      }
      return false;
    } finally {
      setPending(undefined);
    }
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
            if (await run(cancelSubscription, 'cancel')) await afterChange();
          },
        },
      ],
    );
  }

  async function reactivate() {
    if (await run(reactivateSubscription, 'reactivate')) {
      await afterChange();
      Alert.alert('Assinatura reativada', 'Seu Premium continua renovando normalmente.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Meu plano" />
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
        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        {!data ? (
          loading && (
            <View style={styles.loading}>
              <Skeleton width={320} height={200} />
              <Skeleton width={320} height={200} />
            </View>
          )
        ) : premium ? (
          <>
            <View style={[styles.card, styles.cardPremium]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{premium.planName}</Text>
                <IconCrown size={22} color={colors.primary} />
              </View>
              <Price value={premium.price} suffix={billingPeriodSuffix(premium.billingPeriod)} />
              <BenefitList items={PREMIUM_BENEFITS} />

              {inGrace ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeTitle}>Renovação pendente</Text>
                  <Text style={styles.noticeText}>
                    Não conseguimos confirmar a renovação da sua assinatura. Seu Premium continua
                    até {accessUntilLabel} enquanto a cobrança é tentada novamente. Confira a forma
                    de pagamento cadastrada na sua assinatura.
                  </Text>
                </View>
              ) : premium.cancelAtPeriodEnd ? (
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
                    {premium.autoRenew ? 'Renova em ' : 'Válido até '}
                    {formatApiDate(premium.nextBillingDate)}
                  </Text>
                )
              )}

              {active && premium.cancelAtPeriodEnd ? (
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

            {active && !premium.cancelAtPeriodEnd && (
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
            {paymentPending && (
              <View style={[styles.notice, styles.noticeTop]}>
                <Text style={styles.noticeTitle}>Pagamento em confirmação</Text>
                <Text style={styles.noticeText}>
                  Assim que o pagamento for confirmado, seu Premium é liberado aqui automaticamente.
                  Puxe a tela para atualizar.
                </Text>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.planName}>Gratuito</Text>
              <BenefitList items={FREE_BENEFITS} />
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Plano atual</Text>
              </View>
            </View>

            {/* Só informa o que é do Premium: sem preço de venda e sem botão de assinar. */}
            <View style={[styles.card, styles.cardPremium]}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Recursos do Premium</Text>
                <IconCrown size={22} color={colors.primary} />
              </View>
              <BenefitList items={PREMIUM_BENEFITS} />
            </View>

            <Text style={styles.footnote}>
              Se você já tem o Premium, ele é liberado automaticamente quando você entra com a mesma
              conta.
            </Text>
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
  loading: {
    gap: 14,
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
