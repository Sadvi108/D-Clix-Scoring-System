import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Icon, Txt, f1, type IconName } from './primitives';

export type JudgeState = 'waiting' | 'scoring' | 'sent' | 'offline';
const JS: Record<JudgeState, { icon: IconName; label: string }> = {
  waiting: { icon: 'clock', label: 'Waiting' },
  scoring: { icon: 'pencil', label: 'Scoring' },
  sent: { icon: 'check', label: 'Sent' },
  offline: { icon: 'wifi-off', label: 'Offline' },
};
export function JudgeStatusGrid({ judges, chipWidth = 76, onPress }: { judges: { no: number; state: JudgeState; detail?: string }[]; chipWidth?: number; onPress?: (judgeNo: number) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.judges} accessibilityLabel="Judge submissions">
      {judges.map((j) => {
        const t = {
          waiting: { bg: c.surfaceRaised, border: c.hairline, fg: c.inkMuted },
          scoring: { bg: c.surfaceRaised, border: c.gold, fg: c.goldText },
          sent: { bg: c.okSoft, border: c.ok, fg: c.okText },
          offline: { bg: c.alertSoft, border: c.alert, fg: c.alertText },
        }[j.state];
        return (
          <Pressable key={j.no} disabled={!onPress} onPress={() => onPress?.(j.no)} accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={`Judge ${j.no}, ${JS[j.state].label}${onPress ? '. Tap for options' : ''}`}
            style={({ pressed }) => [styles.judge, { width: chipWidth, backgroundColor: t.bg, borderColor: t.border, opacity: pressed ? 0.7 : 1 }, j.detail ? { height: 76 } : null]}>
            <Txt v="scoreMd">J{j.no}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name={JS[j.state].icon} size={12} color={t.fg} />
              <Txt v="caption" color={t.fg} style={{ fontSize: 11 }}>{JS[j.state].label}</Txt>
            </View>
            {j.detail ? <Txt v="caption" color={t.fg} style={{ fontSize: 11 }}>{j.detail}</Txt> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function PinPad({ value, length = 4, error, onDigit, onBack, onClear, keyWidth = 88 }: {
  value: string; length?: number; error?: string | null; onDigit: (d: string) => void; onBack: () => void; onClear: () => void; keyWidth?: number;
}) {
  const { c } = useTheme();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
  return (
    <View style={{ alignItems: 'center', gap: space[3] }}>
      <View style={{ flexDirection: 'row', gap: space[3], height: 20, alignItems: 'center' }} accessibilityLabel={`${value.length} of ${length} digits entered`}>
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.dot, { borderColor: i < value.length ? c.gold : c.controlBorder, backgroundColor: i < value.length ? c.gold : 'transparent' }]} />
        ))}
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }} accessibilityRole="alert">
          <Icon name="alert" size={16} color={c.alertText} />
          <Txt v="caption" color="alertText">{error}</Txt>
        </View>
      ) : null}
      <View style={{ width: keyWidth * 3 + space[2] * 2, flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {keys.map((k) => {
          const fn = k === 'clear' || k === 'back';
          return (
            <Pressable key={k} accessibilityRole="button" accessibilityLabel={k === 'back' ? 'Delete digit' : k}
              onPress={() => (k === 'back' ? onBack() : k === 'clear' ? onClear() : value.length < length && onDigit(k))}
              style={({ pressed }) => [styles.key, { width: keyWidth, backgroundColor: fn ? 'transparent' : pressed ? c.surfaceSunken : c.surfaceRaised, borderColor: fn ? 'transparent' : c.hairline }]}>
              {k === 'back' ? <Icon name="backspace" size={26} color={c.inkMuted} /> : <Txt v={fn ? 'label' : 'scoreLg'} color={fn ? 'inkMuted' : 'ink'} style={fn ? null : { fontSize: 28 }}>{k === 'clear' ? 'Clear' : k}</Txt>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ScoreboardRow({ side, judgeNo, accuracy, presentation, excluded, height = 52, mirror }: { side: 'chung' | 'hong'; judgeNo: number; accuracy: number | null; presentation: number | null; excluded?: 'high' | 'low' | null; height?: number; mirror?: boolean }) {
  const { c } = useTheme();
  const cell = (v: number | null) => (
    <View style={[styles.sbCell, { height }, excluded ? { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.controlBorder } : { backgroundColor: c.surfaceRaised }]}>
      <Txt v="scoreLg" color={excluded ? 'inkMuted' : 'ink'} style={[{ fontSize: height * 0.6, lineHeight: height * 0.7 }, excluded && { textDecorationLine: 'line-through' }]}>{f1(v)}</Txt>
    </View>
  );
  const no = (
    <View style={[styles.sbNo, { height, backgroundColor: side === 'chung' ? c.chung : c.hong }]}>
      <Txt v="scoreLg" color="#ffffff" style={{ fontSize: height * 0.6, lineHeight: height * 0.7 }}>{judgeNo}</Txt>
    </View>
  );
  const tag = (
    <View style={styles.sbTag}>
      <Txt v="overline" color={excluded ? 'inkMuted' : 'okText'} style={{ fontSize: 10, textAlign: 'center' }}>{excluded ? `${excluded} · excluded` : 'Counted'}</Txt>
    </View>
  );
  return (
    <View style={styles.sbRow}>
      {(mirror ?? side === 'hong') ? <>{tag}{cell(accuracy)}{cell(presentation)}{no}</> : <>{no}{cell(accuracy)}{cell(presentation)}{tag}</>}
    </View>
  );
}

export function StepTrack({ steps, showLabels = true }: { steps: { label: string; state: 'done' | 'current' | 'todo' }[]; showLabels?: boolean }) {
  const { c } = useTheme();
  const curIdx = steps.findIndex((s) => s.state === 'current');
  const allDone = steps.every((s) => s.state === 'done');
  return (
    <View style={{ gap: 6 }}>
    <View style={styles.steps} accessibilityLabel="Performance progress">
      {steps.map((s, i) => (
        <View key={s.label} style={[styles.step, i === steps.length - 1 && { flex: 0 }]}>
          <View style={[styles.stepDot, s.state === 'done' ? { backgroundColor: c.ok, borderColor: c.ok } : s.state === 'current' ? { backgroundColor: c.goldSoft, borderColor: c.gold } : { borderColor: c.controlBorder }]}>
            {s.state === 'done' ? <Icon name="check" size={13} stroke={3} color={c.onOk} /> : <Txt v="caption" color={s.state === 'current' ? 'goldText' : 'inkMuted'} style={{ fontSize: 12 }}>{i + 1}</Txt>}
          </View>
          {showLabels ? <Txt v="caption" color={s.state === 'todo' ? 'inkMuted' : 'ink'} numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>{s.label}</Txt> : null}
          {i < steps.length - 1 ? <View style={[styles.stepLine, { backgroundColor: s.state === 'done' ? c.ok : c.hairline }]} /> : null}
        </View>
      ))}
    </View>
    {!showLabels ? (
      <Txt v="caption" color="inkMuted">
        {allDone ? `Step ${steps.length} of ${steps.length} · ${steps[steps.length - 1].label}` : curIdx >= 0 ? `Step ${curIdx + 1} of ${steps.length} · ${steps[curIdx].label}` : 'Nothing on the mat'}
      </Txt>
    ) : null}
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: c.surfaceRaised, borderColor: c.hairline }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !!o.disabled }} disabled={o.disabled} onPress={() => onChange(o.value)}
            style={[styles.segOpt, on && { backgroundColor: c.surface, borderColor: c.controlBorder, borderWidth: 1.5 }, o.disabled && { opacity: 0.5 }]}>
            {o.disabled ? <Icon name="lock" size={13} color={c.inkMuted} /> : null}
            <Txt v="label" color={on ? 'ink' : 'inkMuted'} style={{ fontSize: 13 }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  judges: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  judge: { height: 62, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  key: { height: 56, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sbRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  sbNo: { width: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sbCell: { flex: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  sbTag: { width: 92, alignItems: 'center' },
  steps: { flexDirection: 'row', alignItems: 'center' },
  step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  stepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 6, minWidth: 8 },
  seg: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.md, borderWidth: 1, alignSelf: 'flex-start' },
  segOpt: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.sm, borderWidth: 1.5, borderColor: 'transparent' },
});
