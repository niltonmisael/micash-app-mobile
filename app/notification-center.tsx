import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import IconBell from '@tabler/icons-react-native/IconBell';
import IconChecks from '@tabler/icons-react-native/IconChecks';
import IconSettings from '@tabler/icons-react-native/IconSettings';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorNotice } from '@/components/ErrorNotice';
import { TransactionRowSkeleton } from '@/components/Skeleton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { HandledActionError, useAuthenticatedAction } from '@/hooks/useAuthenticatedAction';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { ApiError } from '@/lib/api';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/notificationCenter';
import { notificationRoute } from '@/lib/notifications';
import type { AppNotification } from '@/types/notifications';
import { formatRelativeDate, formatTime, toDateKey } from '@/utils/format';

const loadFirstPage = (token: string) => getNotifications(token);

/**
 * Central de notificações (sino do Dashboard): GET /api/notification, paginada por cursor.
 * Tocar em uma notificação a marca como lida e abre a rota dela; a engrenagem leva às
 * configurações de notificações deste aparelho.
 */
export default function NotificationCenterScreen() {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const { data, loading, refreshing, error, refresh, retry } = useAuthenticatedQuery(loadFirstPage);

  // Páginas mais antigas ("Carregar mais") e leituras feitas nesta visita, sobre a 1ª página.
  const [older, setOlder] = useState<{ firstId?: number; items: AppNotification[] }>({
    items: [],
  });
  const [olderHasMore, setOlderHasMore] = useState<boolean>();
  const [readIds, setReadIds] = useState<Map<number, string>>(new Map());
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Ao recarregar a 1ª página (puxar ou voltar à tela), as páginas antigas são descartadas.
  const firstPage = data?.notifications ?? [];
  const sameFirstPage = older.firstId === firstPage[0]?.id;
  const olderItems = sameFirstPage ? older.items : [];
  const hasMore = sameFirstPage && olderHasMore !== undefined ? olderHasMore : !!data?.hasMore;
  const notifications = [...firstPage, ...olderItems].map((notification) =>
    readIds.has(notification.id) && notification.readAt === null
      ? { ...notification, readAt: readIds.get(notification.id) ?? null }
      : notification,
  );
  const unread = notifications.filter((notification) => notification.readAt === null);

  function markReadLocally(ids: number[]) {
    const now = new Date().toISOString();
    setReadIds((current) => new Map([...current, ...ids.map((id) => [id, now] as const)]));
  }

  async function loadMore() {
    const last = notifications[notifications.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await runAuthenticated((token) => getNotifications(token, last.id));
      setOlder({ firstId: firstPage[0]?.id, items: [...olderItems, ...page.notifications] });
      setOlderHasMore(page.hasMore);
    } catch (err) {
      if (err instanceof HandledActionError) return;
      Alert.alert('Não foi possível carregar', errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  function open(notification: AppNotification) {
    if (notification.readAt === null) {
      markReadLocally([notification.id]);
      // A leitura não bloqueia a navegação; se falhar, volta como não lida no próximo carregamento.
      runAuthenticated((token) => markNotificationAsRead(token, notification.id)).catch(
        () => undefined,
      );
    }
    const route = notificationRoute({ url: notification.url });
    if (route) router.push(route as Href);
  }

  async function markAll() {
    if (markingAll || unread.length === 0) return;
    setMarkingAll(true);
    try {
      await runAuthenticated((token) => markAllNotificationsAsRead(token));
      markReadLocally(unread.map((notification) => notification.id));
    } catch (err) {
      if (err instanceof HandledActionError) return;
      Alert.alert('Não foi possível marcar como lidas', errorMessage(err));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <IconArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Notificações
        </Text>
        <Pressable
          onPress={() => router.push('/notifications')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Configurações de notificações"
        >
          <IconSettings size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

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
            <View style={styles.card}>
              {Array.from({ length: 4 }, (_, index) => (
                <TransactionRowSkeleton key={index} />
              ))}
            </View>
          )
        ) : notifications.length === 0 ? (
          <View style={[styles.card, styles.empty]}>
            <View style={styles.emptyIcon}>
              <IconBell size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nenhuma notificação por enquanto</Text>
            <Text style={styles.emptyText}>
              Os avisos do MiCash aparecem aqui, mesmo quando as notificações do aparelho estão
              desligadas.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                {unread.length > 0
                  ? `${unread.length} não ${unread.length === 1 ? 'lida' : 'lidas'}`
                  : 'Tudo lido'}
              </Text>
              {unread.length > 0 && (
                <Pressable
                  style={styles.markAll}
                  onPress={markAll}
                  disabled={markingAll}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  {markingAll ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <IconChecks size={16} color={colors.primary} />
                      <Text style={styles.markAllText}>Marcar todas como lidas</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            <View style={styles.card}>
              {notifications.map((notification, index) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  divider={index < notifications.length - 1}
                  onPress={() => open(notification)}
                />
              ))}
            </View>

            {hasMore && (
              <Pressable
                style={styles.loadMore}
                onPress={loadMore}
                disabled={loadingMore}
                hitSlop={8}
                accessibilityRole="button"
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.loadMoreText}>Carregar mais</Text>
                )}
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado. Tente novamente.';
}

function NotificationRow({
  notification,
  divider,
  onPress,
}: {
  notification: AppNotification;
  divider: boolean;
  onPress: () => void;
}) {
  const unread = notification.readAt === null;
  const when = `${formatRelativeDate(toDateKey(notification.createdAt))} · ${formatTime(notification.createdAt)}`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        unread && styles.rowUnread,
        divider && styles.divider,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Não lida. ' : ''}${notification.title}. ${notification.body}. ${when}`}
    >
      <View style={styles.rowIcon}>
        <IconBell size={18} color={colors.primary} />
      </View>
      <View style={styles.rowTexts}>
        <Text style={[styles.rowTitle, unread && styles.rowTitleUnread]} numberOfLines={2}>
          {notification.title}
        </Text>
        <Text style={styles.rowBody} numberOfLines={3}>
          {notification.body}
        </Text>
        <Text style={styles.rowDate}>{when}</Text>
      </View>
      {unread && <View style={styles.dot} accessibilityElementsHidden />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  listTitle: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 24,
  },
  markAllText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowUnread: {
    backgroundColor: colors.cream,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  pressed: {
    opacity: 0.7,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowTitleUnread: {
    fontFamily: fonts.semiBold,
  },
  rowBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  rowDate: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayMedium,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadMore: {
    alignSelf: 'center',
    paddingVertical: 14,
  },
  loadMoreText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
  },
});
