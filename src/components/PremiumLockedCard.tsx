import IconCrown from '@tabler/icons-react-native/IconCrown';
import IconLock from '@tabler/icons-react-native/IconLock';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

type PremiumLockedCardProps = {
  title: string;
  /** Sem mensagem, o cartão fica compacto (ex.: insights bloqueados em sequência). */
  message?: string;
  /** Abre o aviso do recurso Premium. */
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Conteúdo do Premium bloqueado no plano gratuito: cadeado, coroa e toque para o aviso do recurso. */
export function PremiumLockedCard({ title, message, onPress, style }: PremiumLockedCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, recurso Premium${message ? `. ${message}` : ''}`}
    >
      <View style={styles.lock}>
        <IconLock size={18} color={colors.primary} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
      </View>
      <IconCrown size={18} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.beigeStroke,
    borderStyle: 'dashed',
    padding: 16,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.85,
  },
  lock: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
