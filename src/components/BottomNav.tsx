import IconArrowsExchange from '@tabler/icons-react-native/IconArrowsExchange';
import IconChartPie from '@tabler/icons-react-native/IconChartPie';
import IconHome from '@tabler/icons-react-native/IconHome';
import IconPlus from '@tabler/icons-react-native/IconPlus';
import IconUser from '@tabler/icons-react-native/IconUser';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

export type BottomNavItem = 'home' | 'transactions' | 'add' | 'reports' | 'profile';

type TabItem = {
  key: Exclude<BottomNavItem, 'add'>;
  label: string;
  icon: ComponentType<{ size?: number; color?: string }>;
};

const LEFT_TABS: TabItem[] = [
  { key: 'home', label: 'Início', icon: IconHome },
  { key: 'transactions', label: 'Transações', icon: IconArrowsExchange },
];

const RIGHT_TABS: TabItem[] = [
  { key: 'reports', label: 'Relatórios', icon: IconChartPie },
  { key: 'profile', label: 'Perfil', icon: IconUser },
];

type BottomNavProps = {
  active: Exclude<BottomNavItem, 'add'>;
  onPress: (item: BottomNavItem) => void;
};

export function BottomNav({ active, onPress }: BottomNavProps) {
  const insets = useSafeAreaInsets();

  function renderTab({ key, label, icon: Icon }: TabItem) {
    const selected = key === active;
    const color = selected ? colors.primary : colors.grayInactive;
    return (
      <Pressable
        key={key}
        style={styles.tab}
        onPress={() => onPress(key)}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        <Icon size={24} color={color} />
        <Text style={[styles.label, { color }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {LEFT_TABS.map(renderTab)}
      <View style={styles.tab}>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => onPress('add')}
          accessibilityRole="button"
          accessibilityLabel="Adicionar movimentação"
        >
          <IconPlus size={26} color={colors.white} />
        </Pressable>
      </View>
      {RIGHT_TABS.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 10,
    paddingHorizontal: 8,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    justifyContent: 'flex-end',
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -26,
    marginBottom: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  addButtonPressed: {
    opacity: 0.85,
  },
});
