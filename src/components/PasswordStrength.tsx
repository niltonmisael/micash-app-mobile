import IconCheck from '@tabler/icons-react-native/IconCheck';
import IconPoint from '@tabler/icons-react-native/IconPoint';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from '@/constants/typography';
import { PASSWORD_RULES, passwordStrength } from '@/utils/validation';

const STRENGTH_COLORS = {
  fraca: colors.expense,
  média: colors.primary,
  forte: colors.income,
};

type PasswordStrengthProps = {
  password: string;
  /** Lista as regras da API, marcando as já atendidas. */
  showRules?: boolean;
};

/** Barra de força da senha (3 segmentos: fraca, média, forte) e, opcionalmente, as regras. */
export function PasswordStrength({ password, showRules }: PasswordStrengthProps) {
  const strength = passwordStrength(password);
  // Sem senha e sem regras, não ocupa espaço (como antes, no Alterar senha).
  if (!password && !showRules) return null;

  return (
    <View style={styles.container}>
      {!!password && (
        <View style={styles.strength} accessibilityLabel={`Força da senha: ${strength.level}`}>
          <View style={styles.bars}>
            {[1, 2, 3].map((step) => {
              const filled =
                step === 1 ||
                (step === 2 && strength.level !== 'fraca') ||
                (step === 3 && strength.level === 'forte');
              return (
                <View
                  key={step}
                  style={[
                    styles.bar,
                    filled && { backgroundColor: STRENGTH_COLORS[strength.level] },
                  ]}
                />
              );
            })}
          </View>
          <Text style={styles.text}>Força da senha: {strength.level}</Text>
        </View>
      )}

      {showRules && (
        <View style={styles.rules} accessibilityRole="list">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(password);
            return (
              <View
                key={rule.label}
                style={styles.rule}
                accessible
                accessibilityLabel={`${rule.label}: ${met ? 'atendido' : 'pendente'}`}
              >
                {met ? (
                  <IconCheck size={16} color={colors.income} />
                ) : (
                  <IconPoint size={16} color={colors.grayMedium} />
                )}
                <Text style={[styles.ruleText, met && styles.ruleMet]}>{rule.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 12,
  },
  strength: {
    gap: 6,
  },
  bars: {
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grayLight,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  rules: {
    gap: 4,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  ruleMet: {
    color: colors.income,
  },
});
