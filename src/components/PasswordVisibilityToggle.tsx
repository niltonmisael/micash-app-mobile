import IconEye from '@tabler/icons-react-native/IconEye';
import IconEyeOff from '@tabler/icons-react-native/IconEyeOff';
import { Pressable } from 'react-native';

import { colors } from '@/constants/colors';

type PasswordVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

/** Botão de olho usado como `accessory` do `TextField` em campos de senha. */
export function PasswordVisibilityToggle({ visible, onToggle }: PasswordVisibilityToggleProps) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {visible ? (
        <IconEyeOff size={20} color={colors.grayMedium} />
      ) : (
        <IconEye size={20} color={colors.grayMedium} />
      )}
    </Pressable>
  );
}
