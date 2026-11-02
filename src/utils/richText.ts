// Subconjunto de Markdown usado pela IA nas respostas (negrito, listas e títulos), convertido
// em blocos simples para exibir com `Text` nativo. O resto vira texto comum.

export type RichSegment = {
  text: string;
  bold: boolean;
};

export type RichBlock = {
  kind: 'paragraph' | 'bullet';
  /** Marcador de lista numerada ("1."); listas comuns usam "•" na exibição. */
  marker?: string;
  segments: RichSegment[];
};

const BULLET = /^[-*•]\s+/;
const NUMBERED = /^(\d+[.)])\s+/;
const HEADING = /^#{1,6}\s+/;

/** "Você gastou **R$ 650**" → segmentos com e sem negrito; `*itálico*` vira texto comum. */
export function parseInline(text: string, bold = false): RichSegment[] {
  const segments: RichSegment[] = [];
  const parts = text.split(/\*\*(.+?)\*\*/g);
  parts.forEach((part, index) => {
    const clean = part.replace(/\*([^*\s][^*]*?)\*/g, '$1');
    if (clean) segments.push({ text: clean, bold: bold || index % 2 === 1 });
  });
  return segments;
}

export function parseRichText(text: string): RichBlock[] {
  const blocks: RichBlock[] = [];

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line || /^(-{3,}|\*{3,})$/.test(line)) continue;

    if (HEADING.test(line)) {
      blocks.push({ kind: 'paragraph', segments: parseInline(line.replace(HEADING, ''), true) });
      continue;
    }

    const numbered = line.match(NUMBERED);
    if (numbered) {
      blocks.push({
        kind: 'bullet',
        marker: numbered[1],
        segments: parseInline(line.slice(numbered[0].length)),
      });
      continue;
    }

    if (BULLET.test(line)) {
      blocks.push({ kind: 'bullet', segments: parseInline(line.replace(BULLET, '')) });
      continue;
    }

    blocks.push({ kind: 'paragraph', segments: parseInline(line) });
  }

  return blocks;
}
