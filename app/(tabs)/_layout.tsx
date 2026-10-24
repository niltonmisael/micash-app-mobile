import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';

import { AddTransactionSheet } from '@/components/AddTransactionSheet';
import { BottomNav } from '@/components/BottomNav';
import type { BottomNavItem } from '@/components/BottomNav';
import { colors } from '@/constants/colors';

type TabRoute = 'home' | 'transactions' | 'reports' | 'profile' | 'categories';

// Abas da área autenticada: Início, Transações, Relatórios, Perfil e Categorias
// (oculta da barra, aberta pelo Perfil).
export default function TabsLayout() {
  const router = useRouter();
  const [sheetVisible, setSheetVisible] = useState(false);

  function handleSelect(kind: 'income' | 'expense') {
    setSheetVisible(false);
    router.push({ pathname: '/new-transaction', params: { type: kind } });
  }

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.cream } }}
        tabBar={({ state, navigation }) => {
          const route = state.routes[state.index].name as TabRoute;
          // Categorias é acessada pelo Perfil: a barra destaca "Perfil" nessa tela.
          const active = route === 'categories' ? 'profile' : route;

          function handlePress(item: BottomNavItem) {
            if (item === 'add') {
              setSheetVisible(true);
              return;
            }
            if (item !== route) navigation.navigate(item);
          }

          return <BottomNav active={active} onPress={handlePress} />;
        }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="profile" />
        {/* Fora da barra (href: null); aberta pelo Perfil. */}
        <Tabs.Screen name="categories" options={{ href: null }} />
      </Tabs>

      <AddTransactionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelect={handleSelect}
      />
    </>
  );
}
