import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeContext';
import { fonts, radius, space, type, type Palette } from '@/theme/tokens';

// ---------- Text ----------
type Variant = keyof typeof type;
export function Txt({ v = 'body', color, style, ...rest }: TextProps & { v?: Variant; color?: keyof Palette | string }) {
  const { c } = useTheme();
  const col = color ? ((c as Record<string, string>)[color] ?? color) : c.ink;
  const flat = { ...(StyleSheet.flatten([type[v] as TextStyle, { color: col }, v.startsWith('score') && styles.tabular, style]) as TextStyle) };
  // Saira Condensed has tall ascenders: keep display numerals from clipping when lineHeight ≈ fontSize.
  if (v.startsWith('score') && flat.fontSize && (!flat.lineHeight || flat.lineHeight < flat.fontSize * 1.18)) flat.lineHeight = Math.round(flat.fontSize * 1.18);
  return <Text {...rest} style={flat} />;
}

// ---------- Icon (24px grid, 2px round stroke, from the design system) ----------
const PATHS: Record<string, string[]> = {
  undo: ['M9 14 4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  send: ['M4 12 20 4l-6 16-2.5-6.5z'],
  wifi: ['M2.5 9a14 14 0 0 1 19 0', 'M5.5 12.5a9.5 9.5 0 0 1 13 0', 'M8.8 16a5 5 0 0 1 6.4 0', 'M12 19.5h.01'],
  'wifi-off': ['M2.5 9a14 14 0 0 1 4-2.6', 'M10.5 4.6A14 14 0 0 1 21.5 9', 'M8.8 16a5 5 0 0 1 6.4 0', 'M12 19.5h.01', 'M3 3l18 18'],
  lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18', 'M12 7.5V12l3 2'],
  alert: ['M12 4 21 20H3z', 'M12 10v4', 'M12 17h.01'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.6', 'M20 4v5h-5'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  pencil: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  qr: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h2v2h-2z', 'M18 18h2v2h-2z', 'M14 18h2v2h-2z', 'M18 14h2v2h-2z'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 1 0 0 8', 'M4 20a8 8 0 0 1 16 0'],
  users: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 1 0 0 7', 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.5a3.5 3.5 0 0 1 0 6.5', 'M18 14a6 6 0 0 1 3.5 6'],
  backspace: ['M9 5h11v14H9l-6-7z', 'M12 9.5l5 5', 'M17 9.5l-5 5'],
  flag: ['M5 21V4', 'M5 4h12l-2 4 2 4H5'],
  signout: ['M10 4H5v16h5', 'M15 8l4 4-4 4', 'M19 12H9'],
  tv: ['M3 5h18v12H3z', 'M8 21h8', 'M12 17v4'],
  sliders: ['M4 6h9', 'M17 6h3', 'M15 4v4', 'M4 12h3', 'M11 12h9', 'M9 10v4', 'M4 18h11', 'M19 18h1', 'M17 16v4'],
  chevron: ['M9 6l6 6-6 6'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  dot: ['M12 12h.01'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  swap: ['M7 4 3 8l4 4', 'M3 8h14', 'M17 20l4-4-4-4', 'M21 16H7'],
  award: ['M12 15a6 6 0 1 0 0-12 6 6 0 1 0 0 12', 'M8.5 14 7 21l5-3 5 3-1.5-7'],
  list: ['M9 6h11', 'M9 12h11', 'M9 18h11', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  device: ['M7 3h10v18H7z', 'M11 18h2'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
};
export type IconName = keyof typeof PATHS;
export function Icon({ name, size = 20, color, stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? c.ink} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {(PATHS[name] ?? PATHS.dot).map((d, i) => <Path key={i} d={d} />)}
    </Svg>
  );
}

// ---------- Button ----------
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'chung' | 'hong' | 'danger';
export function Button({ label, icon, variant = 'primary', size = 'md', disabled, onPress, block, style, accessibilityLabel }: {
  label?: string; icon?: IconName; variant?: ButtonVariant; size?: 'md' | 'lg'; disabled?: boolean; onPress?: () => void; block?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const map: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.gold, fg: c.onGold, border: c.gold },
    secondary: { bg: c.surfaceRaised, fg: c.ink, border: c.controlBorder },
    ghost: { bg: 'transparent', fg: c.ink, border: 'transparent' },
    chung: { bg: c.chung, fg: c.onChung, border: c.chung },
    hong: { bg: c.hong, fg: c.onHong, border: c.hong },
    danger: { bg: 'transparent', fg: c.alertText, border: c.alert },
  };
  const s = map[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { minHeight: size === 'lg' ? 56 : 48, paddingHorizontal: size === 'lg' ? space[6] : space[5], backgroundColor: s.bg, borderColor: s.border },
        block && { alignSelf: 'stretch' },
        disabled && { opacity: 0.45 },
        pressed && !disabled && { transform: [{ translateY: 2 }] },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} color={s.fg} /> : null}
      {label ? <Text style={[type.label, { color: s.fg, fontSize: size === 'lg' ? 17 : 15 }]} numberOfLines={1}>{label}</Text> : null}
    </Pressable>
  );
}

// ---------- StatusPill ----------
export type PillStatus = 'ready' | 'waiting' | 'sending' | 'sent' | 'failed' | 'online' | 'offline' | 'locked';
const PILL: Record<PillStatus, { icon: IconName; label: string; tone: 'neutral' | 'ok' | 'warn' | 'alert' }> = {
  ready: { icon: 'pencil', label: 'Ready', tone: 'neutral' },
  waiting: { icon: 'clock', label: 'Waiting', tone: 'neutral' },
  sending: { icon: 'refresh', label: 'Sending…', tone: 'warn' },
  sent: { icon: 'check', label: 'Sent', tone: 'ok' },
  failed: { icon: 'alert', label: 'Not sent', tone: 'alert' },
  online: { icon: 'wifi', label: 'Connected', tone: 'ok' },
  offline: { icon: 'wifi-off', label: 'Offline', tone: 'alert' },
  locked: { icon: 'lock', label: 'Locked', tone: 'neutral' },
};
export function StatusPill({ status, label, detail, compact }: { status: PillStatus; label?: string; detail?: string; compact?: boolean }) {
  const { c } = useTheme();
  const p = PILL[status];
  const tone = {
    neutral: { bg: c.surfaceRaised, fg: c.inkMuted, border: c.hairline },
    ok: { bg: c.okSoft, fg: c.okText, border: c.okSoft },
    warn: { bg: c.goldSoft, fg: c.goldText, border: c.goldSoft },
    alert: { bg: c.alertSoft, fg: c.alertText, border: c.alertSoft },
  }[p.tone];
  return (
    <View accessibilityRole="text" accessibilityLiveRegion="polite" style={[styles.pill, { height: compact ? 28 : 32, backgroundColor: tone.bg, borderColor: tone.border }]}>
      {status === 'sending' ? <ActivityIndicator size="small" color={tone.fg} /> : <Icon name={p.icon} size={15} color={tone.fg} />}
      <Text style={[type.caption, { color: tone.fg, fontFamily: fonts.sansSemi }]} numberOfLines={1}>
        {label ?? p.label}{detail ? ` · ${detail}` : ''}
      </Text>
    </View>
  );
}

// ---------- RuleBadge ----------
export type BadgeTone = 'draft' | 'pending' | 'approved' | 'released' | 'unconfigured';
export function RuleBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  const { c } = useTheme();
  const t = {
    draft: { bg: c.goldSoft, fg: c.goldText, border: c.goldText },
    pending: { bg: c.alertSoft, fg: c.alertText, border: c.alertText },
    approved: { bg: c.okSoft, fg: c.okText, border: c.okText },
    released: { bg: c.ok, fg: c.onOk, border: c.ok },
    unconfigured: { bg: 'transparent', fg: c.inkMuted, border: c.inkMuted },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border, borderStyle: tone === 'unconfigured' ? 'dashed' : 'solid' }]}>
      <Text style={[type.overline, { color: t.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ---------- Panel ----------
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.hairline }, style]}>{children}</View>;
}

/** One decimal for judge devices. Arithmetic is done elsewhere in integer tenths. */
export function f1(n: number | null | undefined) {
  return n == null ? '–.–' : (Math.round(n * 10) / 10).toFixed(1);
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], borderRadius: radius.md, borderWidth: 1.5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: radius.sm, borderWidth: 1, justifyContent: 'center', alignSelf: 'flex-start' },
  panel: { borderRadius: radius.md, borderWidth: 1, padding: space[4], gap: space[3] },
});
