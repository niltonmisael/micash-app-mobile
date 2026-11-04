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
  onSubscribe: () => void;
  onClose: () => void;
};

/** Oferta do Premium ao chegar num limite do plano gratuito (não é um erro). */
export function PremiumOfferSheet({
  visible,
  title,
  message,
  onSubscribe,
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
      <PrimaryButton title="Assinar Premium" onPress={onSubscribe} style={styles.button} />
      <Pressable style={styles.later} onPress={onClose} hitSlop={8} accessibilityRole="button">
        <Text style={styles.laterText}>Agora não</Text>
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
