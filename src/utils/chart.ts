export type ChartPoint = { x: number; y: number };

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Pontos de uma série em uma área de `width` × `height` (y cresce para baixo). `length` é o total
 * de posições do eixo X (ex.: dias do mês); a série pode ter menos valores e terminar antes.
 * Com `max` 0 (sem valores), a linha fica na base.
 */
export function linePoints(
  values: number[],
  length: number,
  max: number,
  width: number,
  height: number,
): ChartPoint[] {
  const step = length > 1 ? width / (length - 1) : 0;
  return values.map((value, index) => ({
    x: round(index * step),
    y: round(max > 0 ? height - (Math.max(value, 0) / max) * height : height),
  }));
}

/**
 * Caminho SVG suavizado: curvas quadráticas com os pontos como controle e os pontos médios como
 * passagem. A curva fica sempre entre os valores vizinhos (não "passa do ponto"), o que mantém
 * subindo uma série acumulada.
 */
export function smoothLinePath(points: ChartPoint[]): string {
  if (points.length === 0) return '';
  const [first] = points;
  if (points.length === 1) return `M${first.x} ${first.y}`;

  const mid = (a: ChartPoint, b: ChartPoint) =>
    `${round((a.x + b.x) / 2)} ${round((a.y + b.y) / 2)}`;
  let path = `M${first.x} ${first.y} L${mid(points[0], points[1])}`;
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index];
    path += ` Q${point.x} ${point.y} ${mid(point, points[index + 1])}`;
  }
  const last = points[points.length - 1];
  return `${path} L${last.x} ${last.y}`;
}
