import IconArrowLeft from '@tabler/icons-react-native/IconArrowLeft';
import IconArrowUp from '@tabler/icons-react-native/IconArrowUp';
import IconBulb from '@tabler/icons-react-native/IconBulb';
import IconChartPie from '@tabler/icons-react-native/IconChartPie';
import IconChevronRight from '@tabler/icons-react-native/IconChevronRight';
import IconCrown from '@tabler/icons-react-native/IconCrown';
import IconDots from '@tabler/icons-react-native/IconDots';
import IconInfoCircle from '@tabler/icons-react-native/IconInfoCircle';
import IconMessagePlus from '@tabler/icons-react-native/IconMessagePlus';
import IconReceipt from '@tabler/icons-react-native/IconReceipt';
import IconSparkles from '@tabler/icons-react-native/IconSparkles';
import IconTarget from '@tabler/icons-react-native/IconTarget';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { RichText } from '@/components/RichText';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import {
  HandledActionError,
  PremiumOfferShownError,
  useAuthenticatedAction,
} from '@/hooks/useAuthenticatedAction';
import { usePlan } from '@/hooks/usePlan';
import { isChatRateLimitError } from '@/lib/api';
import {
  CHAT_MESSAGE_MAX_LENGTH,
  chatErrorMessage,
  getChatHistory,
  sendChatMessage,
  startNewConversation,
} from '@/lib/assistant';
import { getSession } from '@/lib/auth';
import { chatMonthExhaustedMessage, chatUsageLabel } from '@/lib/subscription';
import type { ChatMessage } from '@/types/assistant';
import { formatBrasiliaTime } from '@/utils/format';

type Icon = ComponentType<{ size?: number; color?: string }>;

/** Folga depois do horário de liberação, para a API já ter virado o dia ao recarregar os limites. */
const UNBLOCK_MARGIN_MS = 2000;

type Suggestion = {
  title: string;
  subtitle: string;
  icon: Icon;
  /** Pergunta enviada à MI; sem ela, a sugestão abre uma tela do app. */
  question?: string;
};

// A MI responde com o contexto do mês atual (a API não recebe outro período).
const SUGGESTIONS: Suggestion[] = [
  {
    title: 'Quanto gastei este mês?',
    subtitle: 'Resumo por categoria',
    icon: IconChartPie,
    question: 'Quanto gastei este mês? Mostre um resumo por categoria.',
  },
  {
    title: 'Registrar uma despesa',
    subtitle: 'Abre o formulário de despesa',
    icon: IconReceipt,
  },
  {
    title: 'Como estão minhas metas?',
    subtitle: 'Progresso dos seus limites de gasto',
    icon: IconTarget,
    question: 'Como estão minhas metas de gastos este mês?',
  },
  {
    title: 'Onde posso economizar?',
    subtitle: 'Dicas com base nos seus gastos',
    icon: IconBulb,
    question: 'Onde posso economizar com base nos meus gastos deste mês?',
  },
];

/**
 * Chat com a MI. Ao abrir, mostra a conversa ativa guardada na API (GET /api/chat/messages,
 * paginado do fim para o começo); novas perguntas vão para POST /api/chat/message. "Nova
 * conversa" (POST /api/chat/conversations) encerra a atual e a MI esquece o histórico anterior.
 */
export default function AssistantScreen() {
  const router = useRouter();
  const runAuthenticated = useAuthenticatedAction();
  const scrollRef = useRef<ScrollView>(null);
  // Mensagens enviadas ainda sem id da API usam ids negativos (os da API são positivos).
  const nextLocalId = useRef(-1);
  // Ao carregar mensagens antigas (no topo) a lista não deve pular para o fim.
  const scrollToEndOnChange = useRef(true);
  const [firstName, setFirstName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [startingNew, setStartingNew] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { limits, reloadLimits, showOffer } = usePlan();
  // 429 `CHAT_RATE_LIMIT` (Premium): envio bloqueado até `retryAt` (UTC).
  const [rateLimitedUntil, setRateLimitedUntil] = useState<string>();

  const chat = limits?.chat;
  // Free sem mensagens no mês: o envio só volta com o Premium (ou no próximo mês).
  const monthExhausted = chat?.period === 'month' && chat.remaining <= 0;
  // Premium sem mensagens hoje: volta à meia-noite de Brasília (`resetsAt`).
  const dayExhausted = chat?.period === 'day' && chat.remaining <= 0;
  const blockedUntil = rateLimitedUntil ?? (dayExhausted ? chat?.resetsAt : undefined);
  const blocked = monthExhausted || !!blockedUntil;
  const monthExhaustedMessage = chat ? chatMonthExhaustedMessage(chat) : '';

  // Libera o envio quando passa o `retryAt` (429) ou o `resetsAt` (fim das 30 do dia) e atualiza
  // o contador; sem isso, o Premium ficava bloqueado até reabrir o app.
  useEffect(() => {
    if (!blockedUntil) return;
    const wait = Math.max(0, new Date(blockedUntil).getTime() - Date.now()) + UNBLOCK_MARGIN_MS;
    const timer = setTimeout(() => {
      setRateLimitedUntil(undefined);
      reloadLimits();
    }, wait);
    return () => clearTimeout(timer);
  }, [blockedUntil, reloadLimits]);

  useEffect(() => {
    getSession().then((session) => {
      if (session) setFirstName(session.name.trim().split(/\s+/)[0] ?? '');
    });
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(undefined);
    try {
      const page = await runAuthenticated((token) => getChatHistory(token));
      scrollToEndOnChange.current = true;
      // Perguntas enviadas enquanto o histórico carregava continuam depois dele.
      setMessages((current) => [...page.messages, ...current.filter((message) => message.id < 0)]);
      setHasMore(page.hasMore);
    } catch (err) {
      if (err instanceof HandledActionError) return;
      setHistoryError('Não foi possível carregar a conversa anterior.');
    } finally {
      setLoadingHistory(false);
    }
  }, [runAuthenticated]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || oldest.id < 0 || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await runAuthenticated((token) => getChatHistory(token, oldest.id));
      scrollToEndOnChange.current = false;
      setMessages((current) => [...page.messages, ...current]);
      setHasMore(page.hasMore);
    } catch (err) {
      if (err instanceof HandledActionError) return;
      Alert.alert('Não foi possível carregar', chatErrorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  }

  function confirmNewConversation() {
    setMenuOpen(false);
    Alert.alert(
      'Nova conversa',
      'A MI deixa de considerar as mensagens anteriores. Deseja começar uma nova conversa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Começar', onPress: startConversation },
      ],
    );
  }

  async function startConversation() {
    setStartingNew(true);
    try {
      await runAuthenticated((token) => startNewConversation(token));
      setMessages([]);
      setHasMore(false);
      setHistoryError(undefined);
    } catch (err) {
      if (err instanceof HandledActionError) return;
      Alert.alert('Não foi possível começar uma nova conversa', chatErrorMessage(err));
    } finally {
      setStartingNew(false);
    }
  }

  async function ask(text: string, existingId?: number) {
    const question = text.trim();
    if (!question || sending || !!blockedUntil) return;
    if (monthExhausted) {
      showOffer(monthExhaustedMessage);
      return;
    }

    const id = existingId ?? nextLocalId.current--;
    scrollToEndOnChange.current = true;
    setMessages((current) =>
      existingId === undefined
        ? [...current, { id, role: 'user', text: question }]
        : current.map((message) =>
            message.id === id ? { ...message, error: undefined } : message,
          ),
    );
    setSending(true);
    try {
      const answer = await runAuthenticated((token) => sendChatMessage(token, question));
      // A pergunta passa a usar o id gravado pela API (cursor do histórico).
      setMessages((current) => [
        ...current.map((message) =>
          message.id === id ? { ...message, id: answer.userMessageId } : message,
        ),
        { id: answer.id, role: 'assistant', text: answer.message },
      ]);
    } catch (err) {
      // Limite do Free: a oferta já foi aberta; a pergunta não foi enviada e volta ao campo.
      if (err instanceof PremiumOfferShownError) {
        setMessages((current) => current.filter((message) => message.id !== id));
        if (existingId === undefined) setInput(question);
        return;
      }
      if (err instanceof HandledActionError) return;
      if (isChatRateLimitError(err) && err.retryAt) setRateLimitedUntil(err.retryAt);
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, error: chatErrorMessage(err) } : message,
        ),
      );
    } finally {
      setSending(false);
      // O contador do plano muda a cada envio (inclusive os recusados).
      reloadLimits();
    }
  }

  function submit() {
    if (!input.trim() || sending) return;
    const text = input;
    setInput('');
    ask(text);
  }

  function openSuggestion(suggestion: Suggestion) {
    if (suggestion.question) ask(suggestion.question);
    else router.push({ pathname: '/new-transaction', params: { type: 'expense' } });
  }

  function openTips() {
    setMenuOpen(false);
    router.push('/assistant-tips');
  }

  // A MI conhece os limites de gasto do mês (não as metas de economia): abre nessa aba.
  function openGoals() {
    setMenuOpen(false);
    router.push({ pathname: '/goals', params: { tab: 'limits' } });
  }

  const canSend = !!input.trim() && !sending && !startingNew && !blocked;

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
          <AssistantAvatar size={36} />
          <Text style={styles.headerTitle} accessibilityRole="header">
            MI Assistente
          </Text>
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Mais opções"
          >
            <IconDots size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (messages.length > 0 && scrollToEndOnChange.current) {
              scrollRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          {hasMore && (
            <Pressable
              style={styles.older}
              onPress={loadOlder}
              disabled={loadingOlder}
              hitSlop={8}
              accessibilityRole="button"
            >
              {loadingOlder ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.olderText}>Carregar mensagens anteriores</Text>
              )}
            </Pressable>
          )}

          {!!historyError && (
            <View style={styles.historyError} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{historyError}</Text>
              <Pressable
                onPress={loadHistory}
                disabled={loadingHistory}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={[styles.retry, loadingHistory && styles.disabled]}>
                  Tentar novamente
                </Text>
              </Pressable>
            </View>
          )}

          {(loadingHistory || startingNew) && messages.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={styles.historyLoading} />
          ) : messages.length === 0 ? (
            <View>
              <View style={styles.welcome}>
                <AssistantAvatar size={64} />
                <Text style={styles.welcomeTitle}>
                  {firstName ? `Oi, ${firstName}! 👋` : 'Oi! 👋'}
                </Text>
                <Text style={styles.welcomeText}>
                  Posso responder sobre suas receitas, despesas e metas deste mês.
                </Text>
              </View>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((suggestion) => (
                  <SuggestionCard
                    key={suggestion.title}
                    suggestion={suggestion}
                    onPress={() => openSuggestion(suggestion)}
                  />
                ))}
              </View>
              <View style={styles.disclaimer}>
                <IconInfoCircle size={14} color={colors.textSecondary} />
                <Text style={styles.disclaimerText}>
                  As respostas são geradas por IA a partir dos seus lançamentos e podem conter
                  erros.
                </Text>
              </View>
            </View>
          ) : (
            messages.map((message) =>
              message.role === 'user' ? (
                <View key={message.id} style={styles.userBlock}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userText}>{message.text}</Text>
                  </View>
                  {!!message.error && (
                    <View style={styles.errorBox} accessibilityLiveRegion="polite">
                      <Text style={styles.errorText}>{message.error}</Text>
                      <Pressable
                        onPress={() => ask(message.text, message.id)}
                        disabled={sending}
                        hitSlop={8}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.retry, sending && styles.disabled]}>
                          Tentar novamente
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : (
                <AssistantBubble key={message.id}>
                  <RichText text={message.text} style={styles.assistantText} />
                </AssistantBubble>
              ),
            )
          )}

          {sending && (
            <AssistantBubble>
              <View style={styles.typing} accessibilityLabel="A MI está respondendo">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>Pensando…</Text>
              </View>
            </AssistantBubble>
          )}
        </ScrollView>

        {monthExhausted ? (
          <View style={styles.limitBox} accessibilityLiveRegion="polite">
            <IconCrown size={20} color={colors.primary} />
            <Text style={styles.limitText}>{monthExhaustedMessage}</Text>
            <Pressable
              onPress={() => router.push('/subscription')}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.retry}>Ver plano</Text>
            </Pressable>
          </View>
        ) : blockedUntil ? (
          <Text style={styles.usage} accessibilityLiveRegion="polite">
            Disponível novamente às {formatBrasiliaTime(blockedUntil)}
          </Text>
        ) : (
          chat && <Text style={styles.usage}>{chatUsageLabel(chat)}</Text>
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Pergunte algo ao Mi..."
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            multiline
            accessibilityLabel="Mensagem para a MI"
          />
          <Pressable
            style={[styles.sendButton, !canSend && styles.disabled]}
            onPress={submit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: !canSend }}
          >
            <IconArrowUp size={22} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {messages.length > 0 && !sending && (
          <MenuOption
            label="Nova conversa"
            icon={<IconMessagePlus size={20} color={colors.primary} />}
            onPress={confirmNewConversation}
          />
        )}
        <MenuOption
          label="Dicas do Mi"
          icon={<IconBulb size={20} color={colors.primary} />}
          onPress={openTips}
        />
        <MenuOption
          label="Minhas metas"
          icon={<IconTarget size={20} color={colors.primary} />}
          onPress={openGoals}
        />
        <Pressable
          style={styles.cancel}
          onPress={() => setMenuOpen(false)}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}

function AssistantAvatar({ size }: { size: number }) {
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <IconSparkles size={size * 0.5} color={colors.white} />
    </View>
  );
}

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <View style={styles.assistantRow}>
      <AssistantAvatar size={28} />
      <View style={styles.assistantBubble}>{children}</View>
    </View>
  );
}

function SuggestionCard({ suggestion, onPress }: { suggestion: Suggestion; onPress: () => void }) {
  const Icon = suggestion.icon;
  return (
    <Pressable
      style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={suggestion.subtitle}
    >
      <View style={styles.suggestionIcon}>
        <Icon size={20} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
        <Text style={styles.suggestionSubtitle}>{suggestion.subtitle}</Text>
      </View>
      <IconChevronRight size={18} color={colors.grayMedium} />
    </Pressable>
  );
}

function MenuOption({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuOption, pressed && styles.menuPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      {icon}
      <Text style={styles.menuOptionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  welcome: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  welcomeTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
    marginTop: 6,
  },
  welcomeText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  suggestions: {
    gap: 10,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.beige,
  },
  suggestionTitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  suggestionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  disclaimer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  disclaimerText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  userBlock: {
    alignItems: 'flex-end',
    gap: 6,
  },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: colors.primary,
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  userText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.white,
  },
  errorBox: {
    maxWidth: '82%',
    alignItems: 'flex-end',
    gap: 4,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.expense,
    textAlign: 'right',
  },
  retry: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.primary,
  },
  older: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  olderText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.primary,
  },
  historyError: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  historyLoading: {
    marginTop: 40,
  },
  disabled: {
    opacity: 0.5,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  assistantBubble: {
    flexShrink: 1,
    maxWidth: '85%',
    backgroundColor: colors.white,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  assistantText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  usage: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  limitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.beige,
  },
  limitText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.cream,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 24,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 13,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuPressed: {
    backgroundColor: colors.cream,
  },
  menuOptionText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cancel: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
