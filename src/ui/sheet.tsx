// Centered dialog for officials' actions (seat options, walkover, penalty). No open/close animation:
// taps made during an animation can be dropped on tablets.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Icon, Txt } from './primitives';

export function CenterSheet({ title, subtitle, onClose, children, width = 520 }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; width?: number }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      {/* The reason box sits right above OK: the card moves up with the keyboard so OK stays visible. */}
      <KeyboardAvoidingView style={StyleSheet.absoluteFill} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none">
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline, maxWidth: width, maxHeight: height - 32 }]}>
          <View style={styles.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="title">{title}</Txt>
              {subtitle ? <Txt v="caption" color="inkMuted">{subtitle}</Txt> : null}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}><Icon name="close" size={22} color={c.inkMuted} /></Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space[3] }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** One choice in a list (radio row). */
export function ChoiceRow({ label, detail, on, onPress, tone = 'ink', disabled }: { label: string; detail?: string; on: boolean; onPress: () => void; tone?: 'ink' | 'alert' | 'chung' | 'hong'; disabled?: boolean }) {
  const { c } = useTheme();
  const accent = tone === 'alert' ? c.alert : tone === 'chung' ? c.chung : tone === 'hong' ? c.hong : c.ink;
  const soft = tone === 'alert' ? c.alertSoft : tone === 'chung' ? c.chungSoft : tone === 'hong' ? c.hongSoft : c.surfaceSunken;
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on, disabled }} disabled={disabled} onPress={onPress}
      style={[styles.row, { borderColor: on ? accent : c.hairline, backgroundColor: on ? soft : c.surfaceRaised, opacity: disabled ? 0.45 : 1 }]}>
      <View style={[styles.radio, { borderColor: on ? accent : c.controlBorder }]}>{on ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="label">{label}</Txt>
        {detail ? <Txt v="caption" color="inkMuted">{detail}</Txt> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[4] },
  card: { width: '100%', borderRadius: radius.lg, borderWidth: 1, padding: space[5], gap: space[3] },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.md, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
