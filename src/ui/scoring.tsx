import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, radius, space } from '@/theme/tokens';
import { Icon, Txt, f1, type IconName } from './primitives';

type KeySide = 'chung' | 'hong' | 'solo';

/** The big accuracy key. Each press is one TAP event; a firm haptic confirms it without looking. */
export function DeductionPad({ side, kind, value, count, disabled, onTap, height, style, countLeft }: {
  side: KeySide; kind: 'major' | 'minor'; value: number; count: number; disabled?: boolean; onTap: () => void; height: number; style?: StyleProp<ViewStyle>; countLeft?: boolean;
}) {
  const { c } = useTheme();
  // Cut-off ('solo') has one athlete and uses the blue (Chung) colour; red is PK only.
  const fill = side === 'hong' ? c.hong : c.chung;
  const lip = side === 'hong' ? c.hongDeep : c.chungDeep;
  const fg = '#ffffff';
  const big = Math.min(64, Math.round(height * (kind === 'major' ? 0.36 : 0.42)));
  return (
    <View style={[{ height: height + 6 }, style]}>
      <View style={[StyleSheet.absoluteFill, { top: 6, borderRadius: radius.lg, backgroundColor: lip }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${kind === 'major' ? 'Major' : 'Minor'} deduction minus ${value.toFixed(1)}, ${count} recorded`}
        disabled={disabled}
        onPress={() => {
          Haptics.impactAsync(kind === 'major' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
          onTap();
        }}
        style={({ pressed }) => [
          styles.key,
          { height, backgroundColor: fill, opacity: disabled ? 0.4 : 1, transform: [{ translateY: pressed && !disabled ? 5 : 0 }] },
        ]}
      >
        <Txt v="overline" color={fg} style={{ letterSpacing: 2 }}>{kind === 'major' ? 'Major' : 'Minor'}</Txt>
        <Txt v="scoreHero" color={fg} style={{ fontSize: big, lineHeight: big }}>{'−' + value.toFixed(1)}</Txt>
        <View style={[styles.count, (countLeft ?? side === 'hong') ? { left: 8 } : { right: 8 }, { backgroundColor: c.ground }, height < 120 && { top: 6, minWidth: 24, height: 24 }]}>
          <Txt v="scoreMd" style={{ fontSize: height < 120 ? 14 : 18, lineHeight: height < 120 ? 16 : 20 }}>{count}</Txt>
        </View>
      </Pressable>
    </View>
  );
}

/** −/+ control for one Presentation criterion (tenths). First tap on an empty value lands on max. */
export function CriterionStepper({ side, value, min, max, disabled, onChange, compact }: {
  side: KeySide; value: number | null; min: number; max: number; disabled?: boolean; onChange: (tenths: number) => void; compact?: boolean;
}) {
  const { c } = useTheme();
  const btn = compact ? 44 : 48;
  const chip = side === 'hong' ? c.hong : c.chung;
  const chipFg = '#ffffff';
  const change = (dir: -1 | 1) => {
    Haptics.selectionAsync();
    if (value == null) return onChange(dir < 0 ? max - 1 : max);
    onChange(Math.min(max, Math.max(min, value + dir)));
  };
  return (
    <View style={[styles.stepper, { backgroundColor: c.surfaceRaised, borderColor: c.hairline }]}>
      <StepBtn icon="minus" size={btn} disabled={disabled || (value != null && value <= min)} onPress={() => change(-1)} label="Decrease" />
      <View style={[styles.value, { height: btn, backgroundColor: value == null ? 'transparent' : chip, borderColor: c.controlBorder, borderWidth: value == null ? 1.5 : 0, borderStyle: 'dashed' }]}>
        <Txt v="scoreLg" color={value == null ? 'inkMuted' : chipFg} style={{ fontSize: compact ? 24 : 28, lineHeight: compact ? 28 : 32 }}>{f1(value == null ? null : value / 10)}</Txt>
      </View>
      <StepBtn icon="plus" size={btn} disabled={disabled || (value != null && value >= max)} onPress={() => change(1)} label="Increase" />
    </View>
  );
}

function StepBtn({ icon, size, disabled, onPress, label }: { icon: IconName; size: number; disabled?: boolean; onPress: () => void; label: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.stepBtn, { width: size, height: size, borderColor: c.controlBorder, backgroundColor: pressed ? c.surfaceSunken : c.surface, opacity: disabled ? 0.35 : 1 }]}>
      <Icon name={icon} size={22} />
    </Pressable>
  );
}

export function ScoreSummary({ accuracy, presentation, compact, align = 'start', labels = ['Accuracy', 'Presentation'] }: { accuracy: number | null; presentation: number | null; compact?: boolean; align?: 'start' | 'end'; labels?: [string, string] }) {
  const total = accuracy != null && presentation != null ? accuracy + presentation : null;
  const v = compact ? 22 : 34;
  const part = (k: string, val: string, isTotal?: boolean) => (
    <View>
      <Txt v="overline" color="inkMuted" style={{ fontSize: 10 }}>{k}</Txt>
      <Txt v="scoreLg" color={isTotal ? 'goldText' : 'ink'} style={{ fontSize: isTotal ? v + 8 : v, lineHeight: isTotal ? v + 8 : v + 2 }}>{val}</Txt>
    </View>
  );
  return (
    <View style={[styles.summary, { justifyContent: align === 'end' ? 'flex-end' : 'flex-start' }]} accessibilityLabel={`${labels[0]} ${f1(accuracy)} plus ${labels[1]} ${f1(presentation)} equals ${f1(total)}`}>
      {part(labels[0], f1(accuracy))}
      <Txt v="scoreMd" color="inkMuted">+</Txt>
      {part(labels[1], f1(presentation))}
      <Txt v="scoreMd" color="inkMuted">=</Txt>
      {part('Total', f1(total), true)}
    </View>
  );
}

export type SendState = 'incomplete' | 'ready' | 'confirm' | 'sending' | 'sent' | 'failed';
const SEND: Record<SendState, { label: string; icon: IconName; off?: boolean }> = {
  incomplete: { label: 'Set every criterion to send', icon: 'pencil', off: true },
  ready: { label: 'Send score', icon: 'send' },
  confirm: { label: 'Tap again to confirm', icon: 'check' },
  sending: { label: 'Sending…', icon: 'refresh', off: true },
  sent: { label: 'Sent · locked', icon: 'lock', off: true },
  failed: { label: 'Not sent — tap to retry', icon: 'alert' },
};

export function SendButton({ state, label, detail, onPress, compact, style }: { state: SendState; label?: string; detail?: string | null; onPress?: () => void; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const s = SEND[state];
  const look = {
    incomplete: { bg: c.surfaceRaised, fg: c.inkMuted, border: c.controlBorder, dashed: true },
    ready: { bg: c.gold, fg: c.onGold, border: c.gold, dashed: false },
    confirm: { bg: c.surface, fg: c.goldText, border: c.gold, dashed: false },
    sending: { bg: c.surfaceRaised, fg: c.inkMuted, border: c.surfaceRaised, dashed: false },
    sent: { bg: c.okSoft, fg: c.okText, border: c.ok, dashed: false },
    failed: { bg: c.alertSoft, fg: c.alertText, border: c.alert, dashed: false },
  }[state];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? s.label}
      accessibilityState={{ disabled: !!s.off }}
      disabled={s.off}
      onPress={() => {
        Haptics.notificationAsync(state === 'confirm' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.send,
        { minHeight: compact ? 56 : 64, backgroundColor: look.bg, borderColor: look.border, borderStyle: look.dashed ? 'dashed' : 'solid', transform: [{ translateY: pressed ? 2 : 0 }] },
        state === 'confirm' && { shadowColor: c.gold, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
        style,
      ]}
    >
      {state === 'sending' ? <ActivityIndicator color={look.fg} /> : <Icon name={s.icon} size={22} color={look.fg} />}
      <Txt v="heading" color={look.fg} style={{ fontFamily: fonts.sansBold, fontSize: compact ? 16 : 18 }} numberOfLines={1}>{label ?? s.label}</Txt>
      {detail ? (
        <View style={[styles.detail, { borderLeftColor: look.fg }]}>
          <Txt v="scoreLg" color={look.fg} style={{ fontSize: compact ? 22 : 26, lineHeight: compact ? 24 : 28 }}>{detail}</Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  key: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 2 },
  count: { position: 'absolute', top: 10, minWidth: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 3, borderRadius: radius.pill, borderWidth: 1 },
  stepBtn: { borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  value: { flex: 1, minWidth: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  send: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[3], paddingHorizontal: space[5], borderRadius: radius.md, borderWidth: 2 },
  detail: { borderLeftWidth: 1.5, paddingLeft: space[3] },
});
