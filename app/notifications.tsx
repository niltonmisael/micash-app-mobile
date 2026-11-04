import IconBellOff from '@tabler/icons-react-native/IconBellOff';
import IconBellRinging from '@tabler/icons-react-native/IconBellRinging';
import IconDeviceMobile from '@tabler/icons-react-native/IconDeviceMobile';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { MenuRow } from '@/components/MenuRow';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import {
  getNotificationPermissionState,
  getPushDevices,
  getRegisteredPushToken,
  pushTokenSuffix,
  registerForPushNotifications,
  registerPushDevice,
  sendTestPushNotification,
} from '@/lib/notifications';
import type { NotificationPermissionState, PushUnsupportedReason } from '@/lib/notifications';
import { getNotificationPreferences, updateNotificationPreferences } from '@/lib/user';
import type { PushDevice } from '@/types/notifications';
import type { NotificationPreferences } from '@/types/user';
import { formatDate, toDateKey } from '@/utils/format';

/** Opções gravadas na API (GET/PUT /api/user/notification-preferences). */
const SUMMARY_PREFERENCES: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: 'monthlySummaryPush',
    label: 'Resumo mensal no app',
    description: 'No dia 1, uma notificação com o resumo do mês que terminou.',
  },
  {
    key: 'monthlySummaryEmail',
    label: 'Resumo mensal por e-mail',
    description: 'Receitas, despesas, maiores categorias e metas do mês, no seu e-mail.',
  },
];

const UNSUPPORTED_MESSAGES: Record<PushUnsupportedReason, string> = {
  web: 'As notificações push não estão disponíveis na versão web.',
  simulator: 'O simulador do iOS não recebe notificações push. Use um iPhone físico.',
  'expo-go': 'O Expo Go não recebe notificações push. Use a development build do MiCash.',
};

type NotificationsData = {
  devices: PushDevice[];
  permission: NotificationPermissionState;
  /** Sufixo do token registrado por este aparelho, para reconhecê-lo na lista. */
  currentSuffix?: string;
};

async function loadNotifications(token: string): Promise<NotificationsData> {
  const [devices, registeredToken, permission] = await Promise.all([
    getPushDevices(token),
    getRegisteredPushToken(),
    getNotificationPermissionState(),
  ]);
  return {
    devices,
    permission,
    currentSuffix: registeredToken ? pushTokenSuffix(registeredToken) : undefined,
  };
}

const isCurrentDevice = (device: PushDevice, currentSuffix?: string) =>
  !!currentSuffix && device.isActive && device.tokenSuffix === currentSuffix;

/**
 * Notificações push: situação deste aparelho (permissão e registro na API) e aparelhos da conta
 * (GET /api/device/push-tokens), e as preferências de resumo mensal e comunicações
 * (GET/PUT /api/user/notification-preferences).
 */
export default function NotificationsScreen() {
  const runAuthenticated = useAuthenticatedAction();
  const { data, loading, refreshing, error, refresh, retry } =
    useAuthenticatedQuery(loadNotifications);
  const [activating, setActivating] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  // Ao voltar dos Ajustes do sistema, a permissão pode ter mudado.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshRef.current();
    });
    return () => subscription.remove();
  }, []);

  const activeDevices = data?.devices.filter((device) => device.isActive) ?? [];
  const registeredHere = !!data?.devices.some((device) =>
    isCurrentDevice(device, data.currentSuffix),
  );

  async function activate() {
    setActivating(true);
    try {
      const result = await registerForPushNotifications();
      if (result.status === 'granted') {
        await runAuthenticated((token) => registerPushDevice(token, result.token));
      } else if (result.status === 'error') {
        Alert.alert('Não foi possível ativar', result.message);
      } else if (result.status === 'unsupported') {
        Alert.alert('Não disponível', UNSUPPORTED_MESSAGES[result.reason]);
      }
      await refresh();
    } catch (err) {
      if (err instanceof HandledActionError) return;
      Alert.alert(
        'Não foi possível ativar',
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
    } finally {
      setActivating(false);
    }
  }

  async function sendTest() {
    setSendingTest(true);
    try {
      const result = await runAuthenticated((token) => sendTestPushNotification(token));
      Alert.alert(
        'Notificação enviada',
        `Enviada para ${result.devices} ${result.devices === 1 ? 'aparelho' : 'aparelhos'}. Ela deve chegar em alguns segundos.`,
      );
      await refresh();
    } catch (err) {
      if (err instanceof HandledActionError) return;
      const message =
        err instanceof ApiError && err.status === 404
          ? 'O envio de teste só está disponível com a API em ambiente de desenvolvimento.'
          : err instanceof ApiError
            ? err.message
            : 'Ocorreu um erro inesperado. Tente novamente.';
      Alert.alert('Não foi possível enviar', message);
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Notificações" />
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

        <Text style={styles.sectionTitle}>Este aparelho</Text>
        <View style={[styles.card, styles.deviceCard]}>
          {!data ? (
            loading && <Skeleton width={240} height={18} />
          ) : (
            <ThisDevice
              permission={data.permission}
              registered={registeredHere}
              activating={activating}
              onActivate={activate}
            />
          )}
        </View>

        <Text style={styles.sectionTitle}>Aparelhos conectados</Text>
        <View style={styles.card}>
          {!data ? (
            loading && (
              <View style={styles.deviceCard}>
                <Skeleton width={200} height={18} />
              </View>
            )
          ) : data.devices.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum aparelho recebe notificações desta conta.</Text>
          ) : (
            data.devices.map((device, index) => (
              <MenuRow
                key={device.id}
                icon={IconDeviceMobile}
                label={deviceLabel(device)}
                description={deviceDescription(device, data.currentSuffix)}
                value={device.isActive ? 'Ativo' : 'Desativado'}
                valueHighlighted={device.isActive}
                divider={index < data.devices.length - 1}
              />
            ))
          )}
        </View>

        {/* A rota de teste só existe com a API em Development (fora dela, 404). */}
        {__DEV__ && (
          <PrimaryButton
            title="Enviar notificação de teste"
            onPress={sendTest}
            loading={sendingTest}
            disabled={activeDevices.length === 0}
            style={styles.testButton}
          />
        )}

        <Preferences />
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Resumo mensal (push e e-mail) e novidades. O interruptor muda na hora e volta se a API recusar.
 * Carrega à parte dos aparelhos: um erro em um não esconde o outro.
 */
function Preferences() {
  const runAuthenticated = useAuthenticatedAction();
  const { data, error, retry, loading, refreshing } = useAuthenticatedQuery(
    getNotificationPreferences,
  );
  const [local, setLocal] = useState<NotificationPreferences>();
  const preferences = local ?? data;

  async function change(key: keyof NotificationPreferences, value: boolean) {
    if (!preferences) return;
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setLocal(next);
    try {
      setLocal(await runAuthenticated((token) => updateNotificationPreferences(token, next)));
    } catch (err) {
      setLocal(previous);
      if (err instanceof HandledActionError) return;
      Alert.alert(
        'Não foi possível salvar',
        err instanceof ApiError ? err.message : 'Ocorreu um erro inesperado. Tente novamente.',
      );
    }
  }

  const toggle = (key: keyof NotificationPreferences, label: string) =>
    preferences ? (
      <Switch
        value={preferences[key]}
        onValueChange={(value) => change(key, value)}
        accessibilityLabel={label}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    ) : (
      <Skeleton width={44} height={24} />
    );

  return (
    <>
      <Text style={styles.sectionTitle}>Resumo mensal</Text>
      {!!error && <ErrorNotice message={error} onRetry={retry} retrying={loading || refreshing} />}
      <View style={styles.card}>
        {SUMMARY_PREFERENCES.map((item, index) => (
          <MenuRow
            key={item.key}
            label={item.label}
            description={item.description}
            divider={index < SUMMARY_PREFERENCES.length - 1}
            right={toggle(item.key, item.label)}
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Comunicações</Text>
      <View style={styles.card}>
        <MenuRow
          label="Novidades e ofertas"
          description="E-mails sobre novos recursos e condições especiais. Você pode sair quando quiser."
          divider={false}
          right={toggle('newsEmail', 'Novidades e ofertas')}
        />
      </View>
      <Text style={styles.footnote}>
        E-mails sobre a sua conta (códigos, segurança e cobranças) são sempre enviados.
      </Text>
    </>
  );
}

function ThisDevice({
  permission,
  registered,
  activating,
  onActivate,
}: {
  permission: NotificationPermissionState;
  registered: boolean;
  activating: boolean;
  onActivate: () => void;
}) {
  if (typeof permission === 'object') {
    return <DeviceStatus off text={UNSUPPORTED_MESSAGES[permission.unsupported]} />;
  }
  if (permission === 'denied') {
    return (
      <>
        <DeviceStatus
          off
          text="As notificações do MiCash estão bloqueadas nos ajustes do aparelho."
        />
        <PrimaryButton title="Abrir ajustes" onPress={() => Linking.openSettings()} />
      </>
    );
  }
  if (permission === 'granted' && registered) {
    return <DeviceStatus text="Notificações ativadas neste aparelho." />;
  }
  return (
    <>
      <DeviceStatus
        off
        text={
          permission === 'granted'
            ? 'As notificações estão permitidas, mas este aparelho ainda não está registrado.'
            : 'Ative para receber os avisos do MiCash neste aparelho.'
        }
      />
      <PrimaryButton title="Ativar notificações" onPress={onActivate} loading={activating} />
    </>
  );
}

function DeviceStatus({ text, off }: { text: string; off?: boolean }) {
  const Icon = off ? IconBellOff : IconBellRinging;
  return (
    <View style={styles.status}>
      <Icon size={22} color={off ? colors.grayMedium : colors.income} />
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

function deviceLabel(device: PushDevice): string {
  return device.deviceName || (device.platform === 'ios' ? 'iPhone' : 'Android');
}

/** "Este aparelho · último envio 05 nov 2026" ou "Adicionado em 02 nov 2026". */
function deviceDescription(device: PushDevice, currentSuffix?: string): string {
  const when = device.lastUsedAt
    ? `último envio em ${formatDate(toDateKey(device.lastUsedAt))}`
    : `adicionado em ${formatDate(toDateKey(device.createdAt))}`;
  const text = isCurrentDevice(device, currentSuffix) ? `Este aparelho · ${when}` : when;
  return text.charAt(0).toUpperCase() + text.slice(1);
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
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  deviceCard: {
    padding: 16,
    gap: 14,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  testButton: {
    marginTop: -4,
    marginBottom: 20,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -4,
    marginBottom: 12,
  },
});
