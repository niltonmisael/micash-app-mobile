import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';

import { AddTransactionSheet } from '@/components/AddTransactionSheet';
import { BottomNav } from '@/components/BottomNav';
import type { BottomNavItem } from '@/components/BottomNav';
import { colors } from '@/constants/colors';
import { usePushNotifications } from '@/hooks/usePushNotifications';

type TabRoute = 'home' | 'transactions' | 'reports' | 'profile' | 'categories' | 'goals';

/** Abas ocultas da barra, abertas pelo Perfil: a barra destaca "Perfil" nelas. */
const PROFILE_ROUTES = ['categories', 'goals'] as const;

type ProfileRoute = (typeof PROFILE_ROUTES)[number];

function isProfileRoute(route: TabRoute): route is ProfileRoute {
  return (PROFILE_ROUTES as readonly TabRoute[]).includes(route);
}

// Abas da área autenticada: Início, Transações, Relatórios, Perfil, e Categorias e Metas
// (ocultas da barra, abertas pelo Perfil).
export default function TabsLayout() {
  const router = useRouter();
  const [sheetVisible, setSheetVisible] = useState(false);
  // Área autenticada: só aqui o app pede a permissão de notificações e obtém o token.
  usePushNotifications();

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
          const active = isProfileRoute(route) ? 'profile' : route;

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
        {/* Fora da barra (href: null); abertas pelo Perfil (Metas também pelo Dashboard). */}
        <Tabs.Screen name="categories" options={{ href: null }} />
        <Tabs.Screen name="goals" options={{ href: null }} />
      </Tabs>

      <AddTransactionSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelect={handleSelect}
      />
    </>
  );
}
