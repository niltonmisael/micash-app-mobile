import IconAdjustmentsHorizontal from '@tabler/icons-react-native/IconAdjustmentsHorizontal';
import IconBell from '@tabler/icons-react-native/IconBell';
import IconHelpCircle from '@tabler/icons-react-native/IconHelpCircle';
import IconLock from '@tabler/icons-react-native/IconLock';
import IconLogout from '@tabler/icons-react-native/IconLogout';
import IconSettings from '@tabler/icons-react-native/IconSettings';
import IconSparkles from '@tabler/icons-react-native/IconSparkles';
import IconStar from '@tabler/icons-react-native/IconStar';
import IconTag from '@tabler/icons-react-native/IconTag';
import IconTarget from '@tabler/icons-react-native/IconTarget';
import IconUser from '@tabler/icons-react-native/IconUser';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ErrorNotice } from '@/components/ErrorNotice';
import { MenuRow } from '@/components/MenuRow';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { logout } from '@/lib/auth';
import { getCurrentSubscription, isFreePlan, subscriptionStatusLabel } from '@/lib/subscription';
import { getProfile } from '@/lib/user';

async function getProfileOverview(token: string) {
  const [profile, subscription] = await Promise.all([
    getProfile(token),
    getCurrentSubscription(token),
  ]);
  return { profile, subscription };
}

function showComingSoon(feature: string) {
  Alert.alert('Em breve', `${feature} estará disponível em uma próxima versão.`);
}

export default function ProfileScreen() {
  const router = useRouter();
  const { data, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(getProfileOverview);
  const [signingOut, setSigningOut] = useState(false);

  function confirmSignOut() {
    Alert.alert('Sair da conta', 'Deseja sair da sua conta neste aparelho?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }

  const subscription = data?.subscription;
  // Só a API decide o Premium: um pagamento ainda em confirmação continua como Gratuito.
  const planLabel = subscription
    ? subscription.isPremium
      ? subscription.planName
      : 'Gratuito'
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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
          Perfil
        </Text>

        {!!error && (
          <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />
        )}

        <View style={styles.identity}>
          {data ? (
            <>
              <Avatar name={data.profile.name} />
              <Text style={styles.name}>{data.profile.name}</Text>
              <Text style={styles.email}>{data.profile.email}</Text>
            </>
          ) : (
            <>
              <Skeleton width={80} height={80} style={styles.avatarSkeleton} />
              <Skeleton width={160} height={18} />
              <Skeleton width={200} height={14} />
            </>
          )}
        </View>

        <View style={styles.card}>
          <MenuRow
            icon={IconUser}
            label="Dados pessoais"
            onPress={() => router.push('/personal-data')}
          />
          <MenuRow
            icon={IconLock}
            label="Alterar senha"
            onPress={() => router.push('/change-password')}
          />
          <MenuRow icon={IconTag} label="Categorias" onPress={() => router.push('/categories')} />
          <MenuRow
            icon={IconTarget}
            label="Metas"
            onPress={() => router.push({ pathname: '/goals', params: { tab: 'savings' } })}
          />
          <MenuRow
            icon={IconSparkles}
            label="MI Assistente"
            onPress={() => router.push('/assistant')}
          />
          <MenuRow
            icon={IconAdjustmentsHorizontal}
            label="Preferências"
            onPress={() => showComingSoon('As preferências')}
          />
          <MenuRow
            icon={IconBell}
            label="Notificações"
            onPress={() => router.push('/notifications')}
          />
          <MenuRow
            icon={IconStar}
            label="Meu plano"
            value={planLabel}
            valueHighlighted={!!subscription?.isPremium}
            description={
              subscription && !isFreePlan(subscription)
                ? subscriptionStatusLabel(subscription)
                : undefined
            }
            onPress={() => router.push('/subscription')}
          />
          <MenuRow
            icon={IconSettings}
            label="Configurações"
            onPress={() => router.push('/settings')}
            divider={false}
          />
        </View>

        <View style={styles.card}>
          <MenuRow
            icon={IconHelpCircle}
            label="Ajuda e suporte"
            onPress={() => showComingSoon('A central de ajuda')}
          />
          <MenuRow
            icon={IconLogout}
            label={signingOut ? 'Saindo...' : 'Sair da conta'}
            destructive
            disabled={signingOut}
            onPress={confirmSignOut}
            divider={false}
          />
        </View>
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  identity: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  avatarSkeleton: {
    borderRadius: 40,
  },
  name: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textPrimary,
    marginTop: 6,
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
  },
});
