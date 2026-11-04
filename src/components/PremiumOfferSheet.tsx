import IconCrown from '@tabler/icons-react-native/IconCrown';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

type PremiumOfferSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Abre a tela do plano (o que o usuário tem e o que é do Premium). */
  onOpenPlan: () => void;
  onClose: () => void;
};

/**
 * Aviso de recurso Premium ao chegar num limite do plano gratuito (não é um erro). O app não vende
 * assinaturas: o aviso explica o recurso, sem preço nem botão de compra.
 */
export function PremiumOfferSheet({
  visible,
  title,
  message,
  onOpenPlan,
  onClose,
}: PremiumOfferSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.crown}>
        <IconCrown size={28} color={colors.primary} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      <PrimaryButton title="Ver meu plano" onPress={onOpenPlan} style={styles.button} />
      <Pressable style={styles.later} onPress={onClose} hitSlop={8} accessibilityRole="button">
        <Text style={styles.laterText}>Fechar</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  crown: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.beige,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  button: {
    marginTop: 22,
  },
  later: {
    alignSelf: 'center',
    paddingVertical: 14,
  },
  laterText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
