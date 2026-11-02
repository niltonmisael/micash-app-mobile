import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { colors } from '@/constants/colors';
import { configureForegroundNotifications } from '@/lib/notifications';

// Antes de qualquer notificação chegar: com o app aberto, ela aparece como banner.
configureForegroundNotifications();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Se a fonte falhar, segue com a fonte do sistema em vez de travar o app.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.cream },
      }}
    />
  );
}
