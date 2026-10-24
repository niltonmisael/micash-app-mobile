import Svg, { Circle, G } from 'react-native-svg';

import { colors } from '@/constants/colors';

type DonutChartProps = {
  /** Segmentos na ordem de desenho, a partir do topo, em sentido horário. */
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
};

/** Gráfico de rosca desenhado com `react-native-svg` (sem biblioteca de gráficos). */
export function DonutChart({ segments, size = 120, thickness = 22 }: DonutChartProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  // Comprimento de cada segmento no contorno e onde ele começa (soma dos anteriores).
  const lengths = segments.map((segment) =>
    total > 0 ? (segment.value / total) * circumference : 0,
  );
  const starts = lengths.map((_, index) =>
    lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  );

  return (
    <Svg width={size} height={size} accessibilityElementsHidden>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.grayLight}
        strokeWidth={thickness}
        fill="none"
      />
      {total > 0 && (
        // Gira -90° para o primeiro segmento começar no topo.
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {segments.map((segment, index) => (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={segment.color}
              strokeWidth={thickness}
              strokeDasharray={`${lengths[index]} ${circumference - lengths[index]}`}
              strokeDashoffset={-starts[index]}
              fill="none"
            />
          ))}
        </G>
      )}
    </Svg>
  );
}
