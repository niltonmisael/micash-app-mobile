import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';

type ProgressBarProps = {
  /** Percentual de 0 a 100; valores acima de 100 preenchem a barra inteira. */
  value: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

/** Barra horizontal de progresso (ex.: quanto de um limite de gasto já foi usado). */
export function ProgressBar({ value, color, style }: ProgressBarProps) {
  const width = Math.min(Math.max(value, 0), 100);
  return (
    <View
      style={[styles.track, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(width) }}
    >
      <View style={[styles.fill, { width: `${width}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.grayLight,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
