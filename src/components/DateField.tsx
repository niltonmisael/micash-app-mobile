import DateTimePicker from '@react-native-community/datetimepicker';
import IconCalendar from '@tabler/icons-react-native/IconCalendar';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { FieldShell, fieldTextStyle } from '@/components/FieldShell';
import { PrimaryButton } from '@/components/PrimaryButton';
import { colors } from '@/constants/colors';
import { dateFromKey, localDateKey } from '@/utils/format';

type DateFieldProps = {
  label: string;
  /** "AAAA-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  /** Data máxima permitida (ex.: hoje, para despesas). */
  maximumDate?: Date;
  error?: string;
};

/** "AAAA-MM-DD" → "DD/MM/AAAA" */
function displayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Campo de data com o calendário nativo: no Android abre o diálogo do sistema;
 * no iOS, o calendário aparece em uma janela inferior com "Confirmar".
 */
export function DateField({ label, value, onChange, maximumDate, error }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function openPicker() {
    setDraft(value);
    setOpen(true);
  }

  const picker = (
    <DateTimePicker
      value={dateFromKey(Platform.OS === 'ios' ? draft : value)}
      mode="date"
      display={Platform.OS === 'ios' ? 'inline' : 'default'}
      maximumDate={maximumDate}
      accentColor={colors.primary}
      locale="pt-BR"
      onValueChange={(_, date) => {
        if (Platform.OS === 'ios') {
          setDraft(localDateKey(date));
        } else {
          setOpen(false);
          onChange(localDateKey(date));
        }
      }}
      onDismiss={() => setOpen(false)}
    />
  );

  return (
    <>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayDate(value)}`}
      >
        <FieldShell label={label} focused={open} error={error}>
          <Text style={styles.value}>{displayDate(value)}</Text>
          <IconCalendar size={20} color={colors.grayMedium} />
        </FieldShell>
      </Pressable>

      {Platform.OS === 'ios' ? (
        <BottomSheet visible={open} onClose={() => setOpen(false)}>
          {picker}
          <PrimaryButton
            title="Confirmar"
            onPress={() => {
              onChange(draft);
              setOpen(false);
            }}
          />
        </BottomSheet>
      ) : (
        open && picker
      )}
    </>
  );
}

const styles = StyleSheet.create({
  value: {
    ...fieldTextStyle,
    flex: 1,
  },
});
