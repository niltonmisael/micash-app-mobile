import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { SwitchProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MenuRow } from '@/components/MenuRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { authenticateWithBiometrics, getBiometricAvailability } from '@/lib/biometrics';
import type { BiometricAvailability } from '@/lib/biometrics';
import { getSettings, updateSettings } from '@/lib/settings';
import type { AppSettings } from '@/lib/settings';

const BIOMETRIC_UNAVAILABLE: Record<Exclude<BiometricAvailability, 'available'>, string> = {
  'no-hardware': 'Este aparelho não tem leitor biométrico.',
  'not-enrolled': 'Cadastre uma digital ou o rosto nas configurações do aparelho.',
};

function Toggle(props: SwitchProps) {
  return (
    <Switch
      trackColor={{ false: colors.border, true: colors.primarySoft }}
      thumbColor={props.value ? colors.primary : colors.white}
      {...props}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>();
  const [biometrics, setBiometrics] = useState<BiometricAvailability>();
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getSettings(), getBiometricAvailability()]).then(([stored, availability]) => {
        if (!active) return;
        setSettings(stored);
        setBiometrics(availability);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  // Só atualiza a tela depois que a configuração foi gravada no aparelho.
  async function save(changes: Partial<AppSettings>) {
    setSaving(true);
    try {
      setSettings(await updateSettings(changes));
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleBiometrics(enable: boolean) {
    if (!enable) return save({ biometrics: false });
    const availability = await getBiometricAvailability();
    setBiometrics(availability);
    if (availability !== 'available') {
      Alert.alert('Biometria indisponível', BIOMETRIC_UNAVAILABLE[availability]);
      return;
    }
    // Confirma que o usuário consegue se autenticar antes de ativar a trava.
    if (await authenticateWithBiometrics('Confirme para ativar a biometria')) {
      await save({ biometrics: true });
    }
  }

  const biometricsDescription =
    biometrics && biometrics !== 'available'
      ? BIOMETRIC_UNAVAILABLE[biometrics]
      : 'Pede digital ou rosto ao abrir o app.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader title="Configurações" />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="GERAL">
          <MenuRow label="Moeda" value="Real (R$)" description="Única moeda suportada." />
          <MenuRow
            label="Tema"
            value="Claro"
            description="Único tema disponível."
            divider={false}
          />
        </Section>

        <Section title="FINANCEIRO">
          <MenuRow
            label="Dia de início do mês"
            value="1"
            description="Os resumos usam o mês do dia 1 ao último dia."
          />
          <MenuRow
            label="Exibir saldo na tela inicial"
            description="Quando desligado, o Início abre com o saldo oculto."
            right={
              <Toggle
                value={settings?.showBalance ?? true}
                onValueChange={(value) => save({ showBalance: value })}
                disabled={!settings || saving}
                accessibilityLabel="Exibir saldo na tela inicial"
              />
            }
          />
          <MenuRow
            label="Confirmar exclusão de transações"
            description="Disponível quando o app permitir excluir transações."
            disabled
            divider={false}
            right={
              <Toggle
                value={false}
                disabled
                accessibilityLabel="Confirmar exclusão (indisponível)"
              />
            }
          />
        </Section>

        <Section title="SEGURANÇA">
          <MenuRow
            label="Biometria"
            description={biometricsDescription}
            value={settings?.biometrics ? 'Ativado' : 'Desativado'}
            divider={false}
            right={
              <Toggle
                value={settings?.biometrics ?? false}
                onValueChange={toggleBiometrics}
                disabled={!settings || saving}
                accessibilityLabel="Biometria"
              />
            }
          />
        </Section>
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
    paddingTop: 8,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
  },
});
