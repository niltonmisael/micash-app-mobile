import IconCrown from '@tabler/icons-react-native/IconCrown';
import { useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { SessionEndedError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import {
  createCheckout,
  getSubscriptionData,
  isFreePlan,
  subscriptionStatusLabel,
} from '@/lib/subscription';
import { SubscriptionStatus } from '@/types/user';
import type { Plan } from '@/types/user';
import { formatCurrency, formatDate, toDateKey } from '@/utils/format';

export default function SubscriptionScreen() {
  const runAuthenticated = useAuthenticatedAction();
  const { data, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(getSubscriptionData);
  const [checkoutPlanId, setCheckoutPlanId] = useState<number>();

  const current = data?.current;
  const free = !!current && isFreePlan(current);
  // A API recusa um novo checkout enquanto houver assinatura ativa.
  const hasActive = current?.status === SubscriptionStatus.Active && !free;

  async function subscribe(plan: Plan) {
    setCheckoutPlanId(plan.id);
    try {
      const url = await runAuthenticated((token) => createCheckout(token, plan.id));
      // O pagamento acontece no Pagar.me; a assinatura só muda depois da confirmação do
      // pagamento no backend (webhook). Ao voltar ao app, a tela recarrega o status.
      await Linking.openURL(url);
    } catch (err) {
      if (err instanceof SessionEndedError) return;
      Alert.alert(
        'Não foi possível iniciar a assinatura',
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
    } finally {
      setCheckoutPlanId(undefined);
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
          Escolha seu plano
        </Text>

        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        {!data ? (
          loading && (
            <View style={styles.loading}>
              <Skeleton width={320} height={110} />
              <Skeleton width={320} height={110} />
            </View>
          )
        ) : (
          <>
            <View style={[styles.card, free && styles.cardCurrent]}>
              <Text style={styles.planName}>Gratuito</Text>
              <Text style={styles.price}>{formatCurrency(0)}</Text>
              {free ? (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Plano atual</Text>
                </View>
              ) : null}
            </View>

            {!free && current && (
              <View style={[styles.card, styles.cardPremium]}>
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{current.planName}</Text>
                  <IconCrown size={20} color={colors.primary} />
                </View>
                <Text style={styles.price}>{formatCurrency(current.price)}</Text>
                <Text style={styles.status}>Status: {subscriptionStatusLabel(current)}</Text>
                {current.nextBillingDate && !current.cancelAtPeriodEnd && (
                  <Text style={styles.detail}>
                    Próxima cobrança: {formatDate(toDateKey(current.nextBillingDate))}
                  </Text>
                )}
                {current.cancelAtPeriodEnd && current.endsAt && (
                  <Text style={styles.detail}>
                    Cancelada; acesso até {formatDate(toDateKey(current.endsAt))}
                  </Text>
                )}
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Plano atual</Text>
                </View>
              </View>
            )}

            {data.plans
              .filter((plan) => plan.id !== current?.planId)
              .map((plan) => (
                <View key={plan.id} style={[styles.card, styles.cardPremium]}>
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <IconCrown size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.price}>{formatCurrency(plan.price)}</Text>
                  <PrimaryButton
                    title={hasActive ? 'Você já tem uma assinatura ativa' : 'Assinar agora'}
                    onPress={() => subscribe(plan)}
                    loading={checkoutPlanId === plan.id}
                    disabled={hasActive || checkoutPlanId !== undefined}
                    style={styles.subscribeButton}
                  />
                </View>
              ))}

            {data.plans.length === 0 && (
              <Text style={styles.empty}>Nenhum plano pago disponível no momento.</Text>
            )}

            {data.plans.length > 0 && (
              <Text style={styles.footnote}>
                O pagamento é feito no Pagar.me. Sua assinatura é ativada depois da confirmação do
                pagamento.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  cardCurrent: {
    borderColor: colors.border,
  },
  cardPremium: {
    borderColor: colors.primarySoft,
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
  status: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 8,
  },
  detail: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
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
  subscribeButton: {
    marginTop: 14,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
