import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';

type SkeletonProps = {
  width: number;
  height: number;
  /** `light` para usar sobre fundos coloridos (ex.: card bege). */
  tone?: 'default' | 'light';
  style?: StyleProp<ViewStyle>;
};

/** Bloco cinza exibido no lugar de um valor enquanto os dados carregam. */
export function Skeleton({ width, height, tone = 'default', style }: SkeletonProps) {
  return (
    <View
      style={[styles.block, tone === 'light' && styles.light, { width, height }, style]}
      accessibilityLabel="Carregando"
    />
  );
}

/** Linha de movimentação em carregamento, com as mesmas medidas da `TransactionRow`. */
export function TransactionRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={40} height={40} style={styles.icon} />
      <View style={styles.info}>
        <Skeleton width={110} height={14} />
        <Skeleton width={70} height={12} style={styles.gap} />
      </View>
      <Skeleton width={80} height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 6,
    backgroundColor: colors.grayLight,
  },
  light: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  icon: {
    borderRadius: 12,
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  gap: {
    marginTop: 6,
  },
});
