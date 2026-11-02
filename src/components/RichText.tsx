import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { fonts } from '@/constants/typography';
import { parseRichText } from '@/utils/richText';

type RichTextProps = {
  /** Texto da IA, possivelmente com Markdown simples (negrito e listas). */
  text: string;
  style?: StyleProp<TextStyle>;
};

/** Exibe respostas da IA com negrito e listas, sem renderizar Markdown arbitrário. */
export function RichText({ text, style }: RichTextProps) {
  const blocks = parseRichText(text);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        const content = block.segments.map((segment, segmentIndex) => (
          <Text key={segmentIndex} style={segment.bold && styles.bold}>
            {segment.text}
          </Text>
        ));

        if (block.kind === 'bullet') {
          return (
            <View key={index} style={styles.bulletRow}>
              <Text style={[style, styles.marker]}>{block.marker ?? '•'}</Text>
              <Text style={[style, styles.flex]}>{content}</Text>
            </View>
          );
        }
        return (
          <Text key={index} style={style}>
            {content}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  bold: {
    fontFamily: fonts.semiBold,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
  },
  marker: {
    minWidth: 12,
  },
  flex: {
    flex: 1,
  },
});
