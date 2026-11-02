import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { linePoints, smoothLinePath } from '@/utils/chart';

type LineSeries = {
  values: number[];
  color: string;
};

type LineChartProps = {
  series: LineSeries[];
  /** Posições do eixo X (ex.: dias do mês); uma série pode ter menos valores e parar antes. */
  length: number;
  /** Rótulos do eixo X: posição (a partir de 0) e texto. */
  xLabels: { index: number; label: string }[];
  /** Resumo lido pelo leitor de tela (o desenho em si fica oculto). */
  accessibilityLabel: string;
  height?: number;
};

/** Folga para a espessura da linha e o ponto final não serem cortados nas bordas. */
const INSET = 4;
const LABEL_WIDTH = 28;

/** Gráfico de linhas desenhado com `react-native-svg` (sem biblioteca de gráficos). */
export function LineChart({
  series,
  length,
  xLabels,
  accessibilityLabel,
  height = 90,
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const max = Math.max(0, ...series.flatMap((item) => item.values));
  const plotWidth = Math.max(width - INSET * 2, 0);
  const plotHeight = height - INSET * 2;
  const xOf = (index: number) => INSET + (length > 1 ? (index / (length - 1)) * plotWidth : 0);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            <Line
              x1={INSET}
              y1={height - INSET}
              x2={width - INSET}
              y2={height - INSET}
              stroke={colors.grayLight}
              strokeWidth={1}
            />
            {series.map((item, index) => {
              const points = linePoints(item.values, length, max, plotWidth, plotHeight).map(
                (point) => ({ x: point.x + INSET, y: point.y + INSET }),
              );
              const last = points[points.length - 1];
              return (
                <G key={index}>
                  <Path
                    d={smoothLinePath(points)}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {last && <Circle cx={last.x} cy={last.y} r={3} fill={item.color} />}
                </G>
              );
            })}
          </Svg>
          <View style={styles.labels}>
            {xLabels.map((item) => (
              <Text
                key={item.index}
                style={[styles.label, { left: xOf(item.index) - LABEL_WIDTH / 2 }]}
              >
                {item.label}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    height: 16,
    marginTop: 4,
  },
  label: {
    position: 'absolute',
    width: LABEL_WIDTH,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.grayMedium,
  },
});
