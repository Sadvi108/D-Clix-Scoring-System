// Building blocks for the officials' consoles (admin, results): chips, steppers, pickers, rows.
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Icon, Txt, type IconName } from './primitives';

/** Horizontally scrolling single-select chips (categories, rounds, filters). */
export function ChipRow<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingVertical: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? c.ink : c.surface, borderColor: on ? c.ink : c.hairline }]}>
            <Txt v="label" color={on ? c.ground : 'ink'} style={{ fontSize: 13 }}>{o.label}</Txt>
            {o.hint ? <Txt v="caption" color={on ? c.ground : 'inkMuted'} style={{ fontSize: 11 }}>{o.hint}</Txt> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Compact − value + control for setup values (tenths or counts). */
export function MiniStepper({ value, onChange, min, max, step = 1, format = (v) => String(v), disabled, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string; disabled?: boolean; label: string;
}) {
  const { c } = useTheme();
  const btn = (icon: IconName, next: number, can: boolean) => (
    <Pressable onPress={() => onChange(next)} disabled={disabled || !can} accessibilityRole="button" accessibilityLabel={`${icon === 'plus' ? 'Increase' : 'Decrease'} ${label}`}
      style={({ pressed }) => [styles.stepBtn, { borderColor: c.controlBorder, backgroundColor: pressed ? c.surfaceSunken : c.surface }, (disabled || !can) && { opacity: 0.35 }]}>
      <Icon name={icon} size={16} color={c.ink} />
    </Pressable>
  );
  return (
    <View style={styles.stepper} accessibilityLabel={`${label} ${format(value)}`}>
      {btn('minus', value - step, value - step >= min)}
      <Txt v="scoreMd" style={{ minWidth: 44, textAlign: 'center', fontSize: 20 }}>{format(value)}</Txt>
      {btn('plus', value + step, value + step <= max)}
    </View>
  );
}

/** Label + value row used in detail panels. */
export function KV({ k, children }: { k: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.kv, { borderBottomColor: c.hairline }]}>
      <Txt v="caption" color="inkMuted" style={{ flexShrink: 0 }}>{k}</Txt>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{typeof children === 'string' ? <Txt v="label" style={{ textAlign: 'right' }}>{children}</Txt> : children}</View>
    </View>
  );
}

/** Bottom sheet with a list of options. */
export function PickerSheet<T>({ visible, title, items, onPick, onClose, render, keyOf, selected }: {
  visible: boolean; title: string; items: T[]; onPick: (item: T) => void; onClose: () => void; render: (item: T) => ReactNode; keyOf: (item: T) => string; selected?: string | null;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + space[3] }]}>
        <View style={styles.sheetHead}>
          <Txt v="heading">{title}</Txt>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}><Icon name="close" size={22} color={c.inkMuted} /></Pressable>
        </View>
        <ScrollView style={{ maxHeight: 420 }}>
          {items.map((it) => {
            const k = keyOf(it);
            const on = selected === k;
            return (
              <Pressable key={k} onPress={() => onPick(it)} accessibilityRole="button"
                style={({ pressed }) => [styles.sheetRow, { borderBottomColor: c.hairline, backgroundColor: pressed ? c.surfaceRaised : on ? c.goldSoft : 'transparent' }]}>
                <View style={{ flex: 1 }}>{render(it)}</View>
                {on ? <Icon name="check" size={18} color={c.goldText} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Inline message after an action: error (alert) or confirmation (ok). */
export function Notice({ text, tone = 'alert' }: { text: string | null; tone?: 'alert' | 'ok' | 'info' }) {
  const { c } = useTheme();
  if (!text) return null;
  const t = { alert: [c.alertSoft, c.alertText, 'alert'], ok: [c.okSoft, c.okText, 'check'], info: [c.surfaceRaised, c.inkMuted, 'clock'] }[tone] as [string, string, IconName];
  return (
    <View style={[styles.notice, { backgroundColor: t[0] }]} accessibilityLiveRegion="polite">
      <Icon name={t[2]} size={16} color={t[1]} />
      <Txt v="caption" color={t[1]} style={{ flex: 1 }}>{text}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5, justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3], minHeight: 44, borderBottomWidth: 1, paddingVertical: 6 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space[4], paddingTop: space[4], maxWidth: 640, alignSelf: 'center', width: '100%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[2] },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingVertical: space[2], paddingHorizontal: space[2], borderBottomWidth: 1 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: space[3], borderRadius: radius.sm },
});
