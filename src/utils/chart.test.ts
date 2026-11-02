import { linePoints, smoothLinePath } from './chart';

describe('linePoints', () => {
  it('distribui as posições na largura e escala pelo maior valor (y cresce para baixo)', () => {
    expect(linePoints([0, 50, 100], 3, 100, 200, 80)).toEqual([
      { x: 0, y: 80 },
      { x: 100, y: 40 },
      { x: 200, y: 0 },
    ]);
  });

  it('uma série mais curta termina antes, na mesma escala do eixo', () => {
    expect(linePoints([10, 20], 5, 20, 100, 10)).toEqual([
      { x: 0, y: 5 },
      { x: 25, y: 0 },
    ]);
  });

  it('sem valores (máximo 0), a linha fica na base', () => {
    expect(linePoints([0, 0], 2, 0, 100, 60)).toEqual([
      { x: 0, y: 60 },
      { x: 100, y: 60 },
    ]);
  });
});

describe('smoothLinePath', () => {
  it('passa pelos pontos médios e termina no último ponto', () => {
    expect(
      smoothLinePath([
        { x: 0, y: 10 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]),
    ).toBe('M0 10 L5 5 Q10 0 15 0 L20 0');
  });

  it('casos com poucos pontos', () => {
    expect(smoothLinePath([])).toBe('');
    expect(smoothLinePath([{ x: 3, y: 4 }])).toBe('M3 4');
    expect(
      smoothLinePath([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]),
    ).toBe('M0 0 L5 5 L10 10');
  });
});
