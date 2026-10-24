import IconChartBar from '@tabler/icons-react-native/IconChartBar';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';

const SIZES = {
  lg: { box: 88, radius: 24, icon: 44 },
  md: { box: 64, radius: 18, icon: 32 },
} as const;

type AppLogoProps = {
  size?: keyof typeof SIZES;
};

export function AppLogo({ size = 'md' }: AppLogoProps) {
  const { box, radius, icon } = SIZES[size];

  return (
    <View
      style={[styles.box, { width: box, height: box, borderRadius: radius }]}
      accessibilityRole="image"
      accessibilityLabel="Logotipo do MiCash"
    >
      <IconChartBar size={icon} color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
