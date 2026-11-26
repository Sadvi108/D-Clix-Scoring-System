// Small coloured tag for outcomes and states (Released, No-show, Tie, Qualified…).
import { View } from 'react-native';
import type { Tone } from '@/live/chiefView';
import { useTheme } from '@/theme/ThemeContext';
import { Txt } from '@/ui/primitives';

export function ToneTag({ label, tone }: { label: string; tone: Tone }) {
  const { c } = useTheme();
  const t = { ok: [c.okSoft, c.okText], warn: [c.goldSoft, c.goldText], bad: [c.alertSoft, c.alertText], idle: ['transparent', c.inkMuted] }[tone];
  return (
    <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, borderWidth: 1, borderColor: tone === 'idle' ? c.controlBorder : t[0], backgroundColor: t[0], justifyContent: 'center' }}>
      <Txt v="overline" color={t[1]} style={{ fontSize: 10 }}>{label}</Txt>
    </View>
  );
}
