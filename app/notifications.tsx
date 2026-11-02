import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuRow } from '@/components/MenuRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';

const OPTIONS = ['Resumo diário', 'Contas a vencer', 'Lembrete de lançamentos', 'Metas atingidas'];

/**
 * O app já obtém o token de push (`src/lib/notifications.ts`), mas a API ainda não guarda
 * preferências nem envia notificações: as opções aparecem desligadas e bloqueadas, sem salvar nada.
 */
export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Notificações" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Em breve</Text>
          <Text style={styles.noticeText}>
            As notificações ainda não estão disponíveis. Quando estiverem, você poderá ativá-las
            aqui.
          </Text>
        </View>

        <View style={styles.card}>
          {OPTIONS.map((label, index) => (
            <MenuRow
              key={label}
              label={label}
              disabled
              divider={index < OPTIONS.length - 1}
              right={
                <Switch
                  value={false}
                  disabled
                  accessibilityLabel={`${label} (indisponível)`}
                  trackColor={{ false: colors.border, true: colors.primarySoft }}
                  thumbColor={colors.white}
                />
              }
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  notice: {
    backgroundColor: colors.beige,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  noticeTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.primary,
  },
  noticeText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
