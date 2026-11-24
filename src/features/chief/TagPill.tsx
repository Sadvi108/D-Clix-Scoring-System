import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { Txt } from '@/ui/primitives';
import type { GameTag } from './data';

/** RELEASED (green) or how the game ended without scoring (NO-SHOW, WITHDRAWN, DQ; red). */
export function TagPill({ tag }: { tag: GameTag }) {
  const { c } = useTheme();
  const ok = tag === 'RELEASED';
  return (
    <View style={[{ paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center' }, { backgroundColor: ok ? c.okSoft : c.alertSoft }]}>
      <Txt v="overline" color={ok ? 'okText' : 'alertText'} style={{ fontSize: 10 }}>{tag}</Txt>
    </View>
  );
}

