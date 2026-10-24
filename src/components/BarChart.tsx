import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

type Bar = {
  label: string;
  value: number;
  /** Destaca a barra (ex.: mês selecionado). */
  highlighted?: boolean;
  /** Texto lido pelo leitor de tela (ex.: "Outubro: R$ 2.110,00"). */
  accessibilityLabel?: string;
};

type BarChartProps = {
  bars: Bar[];
  height?: number;
};

/** Barras verticais proporcionais ao maior valor, com o rótulo de cada uma abaixo. */
export function BarChart({ bars, height = 110 }: BarChartProps) {
  const max = Math.max(0, ...bars.map((bar) => bar.value));

  return (
    <View>
      <View style={[styles.plot, { height }]}>
        {bars.map((bar, index) => {
          // Valores maiores que zero sempre ficam visíveis, mesmo muito menores que o máximo.
          const barHeight = max > 0 && bar.value > 0 ? Math.max(4, (bar.value / max) * height) : 0;
          return (
            <View
              key={index}
              style={styles.slot}
              accessible
              accessibilityLabel={bar.accessibilityLabel ?? `${bar.label}: ${bar.value}`}
            >
              <View
                style={[
                  styles.bar,
                  { height: barHeight },
                  bar.highlighted ? styles.barHighlighted : styles.barDefault,
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {bars.map((bar, index) => (
          <Text key={index} style={[styles.label, bar.highlighted && styles.labelHighlighted]}>
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.grayLight,
  },
  slot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  barDefault: {
    backgroundColor: colors.beigeStroke,
  },
  barHighlighted: {
    backgroundColor: colors.primary,
  },
  labels: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.grayMedium,
  },
  labelHighlighted: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
});
