import IconBolt from '@tabler/icons-react-native/IconBolt';
import IconBook from '@tabler/icons-react-native/IconBook';
import IconBriefcase from '@tabler/icons-react-native/IconBriefcase';
import IconCar from '@tabler/icons-react-native/IconCar';
import IconDeviceTv from '@tabler/icons-react-native/IconDeviceTv';
import IconDots from '@tabler/icons-react-native/IconDots';
import IconGift from '@tabler/icons-react-native/IconGift';
import IconHeart from '@tabler/icons-react-native/IconHeart';
import IconHome from '@tabler/icons-react-native/IconHome';
import IconPaw from '@tabler/icons-react-native/IconPaw';
import IconPlane from '@tabler/icons-react-native/IconPlane';
import IconShirt from '@tabler/icons-react-native/IconShirt';
import IconShoppingCart from '@tabler/icons-react-native/IconShoppingCart';
import IconTag from '@tabler/icons-react-native/IconTag';
import IconToolsKitchen2 from '@tabler/icons-react-native/IconToolsKitchen2';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { CATEGORY_COLORS, colors } from '@/constants/colors';

export { CATEGORY_COLORS };

type Icon = ComponentType<{ size?: number; color?: string }>;

/**
 * Ícones oferecidos para categorias. A chave é o nome do ícone Tabler, que é o valor gravado
 * no campo `icon` da API (convenção do app; a API aceita qualquer texto).
 */
export const CATEGORY_ICONS: Record<string, Icon> = {
  'shopping-cart': IconShoppingCart,
  'tools-kitchen-2': IconToolsKitchen2,
  car: IconCar,
  home: IconHome,
  heart: IconHeart,
  'device-tv': IconDeviceTv,
  book: IconBook,
  bolt: IconBolt,
  shirt: IconShirt,
  plane: IconPlane,
  paw: IconPaw,
  gift: IconGift,
  briefcase: IconBriefcase,
  dots: IconDots,
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isKnownCategoryIcon(icon: string): boolean {
  return icon in CATEGORY_ICONS;
}

/** Cor válida para exibir; valores fora do padrão (ex.: "amarelo") usam a cor principal. */
export function categoryDisplayColor(color: string | undefined): string {
  return color && HEX_COLOR.test(color) ? color : colors.primary;
}

type CategoryIconProps = {
  /** Valor do campo `icon` da API; valores desconhecidos usam um ícone genérico. */
  icon?: string;
  color?: string;
  size?: number;
};

/** Ícone da categoria em um quadrado com fundo suave, como nos protótipos. */
export function CategoryIcon({ icon, color, size = 40 }: CategoryIconProps) {
  const Component = (icon && CATEGORY_ICONS[icon]) || IconTag;
  const tint = categoryDisplayColor(color);
  return (
    <View
      style={[styles.box, { width: size, height: size, borderRadius: size * 0.3 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Component size={size * 0.45} color={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.beige,
  },
});
