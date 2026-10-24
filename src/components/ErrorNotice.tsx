import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

type ErrorNoticeProps = {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
};

/** Aviso de falha ao carregar dados, com a ação "Tentar novamente". */
export function ErrorNotice({ message, onRetry, retrying }: ErrorNoticeProps) {
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={onRetry} disabled={retrying} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.retry, retrying && styles.retrying]}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.expense,
    padding: 14,
    marginBottom: 14,
    gap: 8,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  retry: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
  },
  retrying: {
    opacity: 0.5,
  },
});
