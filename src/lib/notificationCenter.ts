import { apiGet, apiPut } from '@/lib/api';
import type {
  NotificationsResponse,
  UnreadNotificationsCountResponse,
} from '@/types/notifications';

// Central de notificações (sino), `api/notification`. Toda notificação gerada para o usuário fica
// aqui, tenha ele aparelho ativo ou não; o push é só uma das formas de entregá-la.

const BASE_PATH = '/api/notification';

/** Notificações por página (padrão da API; máximo 50). */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * GET /api/notification — página mais recente ou, com `before` (id da última já exibida), a
 * anterior a ela. 204 vira lista vazia.
 */
export async function getNotifications(
  token: string,
  before?: number,
): Promise<NotificationsResponse> {
  const params: Record<string, number> = { limit: NOTIFICATIONS_PAGE_SIZE };
  if (before !== undefined) params.before = before;
  const response = await apiGet<NotificationsResponse>(BASE_PATH, token, params);
  return { notifications: response?.notifications ?? [], hasMore: response?.hasMore ?? false };
}

/** GET /api/notification/unread-count — número exibido no sino. */
export async function getUnreadNotificationsCount(token: string): Promise<number> {
  const response = await apiGet<UnreadNotificationsCountResponse>(
    `${BASE_PATH}/unread-count`,
    token,
  );
  return response?.count ?? 0;
}

/** PUT /api/notification/{id}/read — idempotente (uma já lida mantém o horário original). */
export async function markNotificationAsRead(token: string, id: number): Promise<void> {
  await apiPut(`${BASE_PATH}/${id}/read`, undefined, token);
}

/** PUT /api/notification/read-all */
export async function markAllNotificationsAsRead(token: string): Promise<void> {
  await apiPut(`${BASE_PATH}/read-all`, undefined, token);
}

/**
 * Id da notificação no `data` do push (a API envia `notificationId` como texto), para marcá-la
 * como lida quando o usuário toca nela.
 */
export function notificationIdFromData(data: unknown): number | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const value = (data as { notificationId?: unknown }).notificationId;
  const id = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isInteger(id) && id > 0 ? id : undefined;
}
