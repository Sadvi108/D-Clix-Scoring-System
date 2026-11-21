import { Pressable, StyleSheet, View } from 'react-native';
import { useLinkPill } from '@/device/network';
import type { Athlete, Side } from '@/core/types';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { flag } from './flag';
import { Icon, RuleBadge, StatusPill, Txt, f1, type PillStatus } from './primitives';

export function MatchBar({ matchNo, ring, category, round, judgeNo, roleLabel, connection, draft = true, compact, onHome }: {
  onHome?: () => void; matchNo?: string; ring?: string; category: string; round?: string; judgeNo?: number; roleLabel?: string; connection?: PillStatus; draft?: boolean; compact?: boolean;
}) {
  const { c } = useTheme();
  // 'online' / 'sending' from a screen means "show this device's real link": Wired, Wi-Fi or Offline.
  const live = useLinkPill(connection === 'sending');
  const pill = connection === 'online' || connection === 'sending' ? live : connection;
  return (
    <View style={[styles.bar, { height: compact ? 48 : 64, backgroundColor: c.surface, borderBottomColor: c.hairline, paddingHorizontal: compact ? space[4] : space[5] }]}>
      <View style={[styles.side, { justifyContent: 'flex-start' }, compact && { flex: 0 }]}>
        {onHome ? (
          <Pressable onPress={onHome} accessibilityRole="button" accessibilityLabel="Back to role menu" hitSlop={8}
            style={({ pressed }) => ({ minWidth: 44, height: 44, paddingHorizontal: compact ? 0 : 12, flexDirection: 'row', gap: 6, borderRadius: 22, borderWidth: compact ? 0 : 1, borderColor: c.hairline, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surfaceRaised : 'transparent' })}>
            <Icon name="menu" size={20} color={c.ink} />
            {!compact ? <Txt v="label">Menu</Txt> : null}
          </Pressable>
        ) : null}
        {matchNo ? <Txt v="scoreMd" style={{ fontSize: compact ? 22 : 28, lineHeight: compact ? 26 : 32 }}>{matchNo}</Txt> : null}
        {ring ? <Txt v="caption" color="inkMuted">{ring}</Txt> : null}
      </View>
      <View style={[styles.center, compact && { flex: 1, minWidth: 0 }]}>
        <Txt v={compact ? 'label' : 'heading'} numberOfLines={1} style={{ flexShrink: 1 }}>{category}</Txt>
        {draft ? <RuleBadge tone="draft" label={compact ? 'UAT' : 'Draft · UAT'} /> : null}
      </View>
      <View style={[styles.side, { justifyContent: 'flex-end' }, compact && { flex: 0 }]}>
        {round && !compact ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{round}</Txt> : null}
        {judgeNo != null ? (
          <View style={styles.judge}>
            <Txt v="overline" color="inkMuted">{roleLabel ?? 'Judge'}</Txt>
            <Txt v="scoreMd" color="goldText" style={{ fontSize: compact ? 22 : 26 }}>{judgeNo}</Txt>
          </View>
        ) : roleLabel && !compact ? <Txt v="overline" color="inkMuted">{roleLabel}</Txt> : null}
        {pill ? <StatusPill status={pill} compact={compact} /> : null}
      </View>
    </View>
  );
}

export function FormClock({ time, form, formNo = 1, formCount = 1, compact, running }: { time: string; form: string; formNo?: number; formCount?: number; compact?: boolean; running?: boolean }) {
  return (
    <View style={{ alignItems: 'center', minWidth: compact ? 100 : 150 }}>
      <Txt v="scoreHero" color={running ? 'goldText' : 'ink'} style={compact ? { fontSize: 34, lineHeight: 34 } : null} accessibilityRole="timer">{time}</Txt>
      <Txt v="overline" style={{ fontSize: compact ? 10 : 13, letterSpacing: 2 }}>{form}</Txt>
      {!compact ? <Txt v="overline" color="inkMuted">{formCount > 1 ? `Form ${formNo} of ${formCount}` : `Form ${formNo}`}</Txt> : null}
    </View>
  );
}

export function mmss(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Athlete identity with the judge's own running Accuracy / Presentation / Total. Hong mirrors Chung. */
export function AthletePlate({ side, athlete, tag, accuracy, presentation, compact, showScores = true, mirror: mirrorProp }: {
  side: Side | 'solo'; athlete: Athlete; tag?: string; accuracy?: number | null; presentation?: number | null; compact?: boolean; showScores?: boolean;
  /** Lay out right-to-left (the plate sits on the right of the screen). Defaults to Hong. */
  mirror?: boolean;
}) {
  const { c } = useTheme();
  // Cut-off ('solo') is a single athlete in blue; red appears only in PK.
  const bg = side === 'hong' ? c.hongSoft : c.chungSoft;
  const tagBg = side === 'hong' ? c.hong : c.chung;
  const tagFg = '#ffffff';
  const total = accuracy != null && presentation != null ? accuracy + presentation : null;
  const mirror = mirrorProp ?? side === 'hong';
  const scores = showScores ? (
    <View style={[styles.scores, mirror && { flexDirection: 'row-reverse' }]}>
      <Cell k="Acc" v={f1(accuracy)} compact={compact} />
      <Cell k="Pres" v={f1(presentation)} compact={compact} />
      <Cell k="Total" v={f1(total)} total compact={compact} />
    </View>
  ) : null;
  return (
    <View style={[styles.plate, { backgroundColor: bg, flexDirection: mirror ? 'row-reverse' : 'row', paddingVertical: compact ? 6 : space[3] }]}>
      <View style={{ flex: 1, minWidth: 0, alignItems: mirror ? 'flex-end' : 'flex-start', gap: 2 }}>
        <View style={{ flexDirection: mirror ? 'row-reverse' : 'row', alignItems: 'center', gap: space[2] }}>
          <View style={[styles.tag, { backgroundColor: tagBg }]}>
            <Txt v="overline" color={tagFg} style={{ fontSize: 10 }}>{(tag ?? (side === 'solo' ? 'Entry' : side)).toUpperCase()}</Txt>
          </View>
          {flag(athlete.nat) ? <Txt style={{ fontSize: compact ? 16 : 22, lineHeight: compact ? 20 : 26 }}>{flag(athlete.nat)}</Txt> : null}
          <Txt v="overline" color="inkMuted" style={{ fontSize: 12 }}>{athlete.nat}</Txt>
        </View>
        <Txt v="title" numberOfLines={1} style={{ textTransform: 'uppercase', fontSize: compact ? 15 : 21, lineHeight: compact ? 19 : 26 }}>{athlete.name}</Txt>
        {athlete.members?.length && !compact ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{athlete.members.join(' · ')}</Txt> : null}
      </View>
      {scores}
    </View>
  );
}

function Cell({ k, v, total, compact }: { k: string; v: string; total?: boolean; compact?: boolean }) {
  return (
    <View style={{ alignItems: 'center', minWidth: compact ? 32 : 40 }}>
      <Txt v="overline" color="inkMuted" style={{ fontSize: compact ? 9 : 11 }}>{k}</Txt>
      <Txt v={total ? 'scoreXl' : 'scoreLg'} color={total ? 'goldText' : 'ink'} style={compact ? { fontSize: total ? 26 : 19, lineHeight: total ? 26 : 22 } : total ? { fontSize: 38, lineHeight: 40 } : { fontSize: 28, lineHeight: 32 }}>{v}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: space[3] },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3], minWidth: 0 },
  center: { flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 },
  judge: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  plate: { borderRadius: radius.md, paddingHorizontal: space[4], alignItems: 'center', gap: space[3], minWidth: 0 },
  tag: { height: 20, paddingHorizontal: 7, borderRadius: radius.sm, justifyContent: 'center' },
  scores: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3] },
});
