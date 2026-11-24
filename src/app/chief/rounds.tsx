// Chief · List of rounds: each round with "scored / total · top N qualify", a progress bar and its state
// (QUALIFIED once the chief confirms). Tap a round to open its standings.
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useScoring } from '@/data';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { roundRows, type RoundBadge } from '@/features/chief/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Icon, Txt } from '@/ui/primitives';

export default function Rounds() {
  return <ChiefShell tab="rounds"><List /></ChiefShell>;
}

function List() {
  const s = useScoring();
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const tone = (b: RoundBadge) => ({
    QUALIFIED: { bg: c.okSoft, fg: c.okText }, TIE: { bg: c.alertSoft, fg: c.alertText }, SCORING: { bg: c.goldSoft, fg: c.goldText },
    SCORED: { bg: c.chungSoft, fg: c.chungText }, 'NOT STARTED': { bg: 'transparent', fg: c.inkMuted },
  })[b];
  const rows = roundRows(s);
  return (
    <>
      <View style={{ gap: 2 }}>
        <Txt v="title" style={{ fontSize: 26 }}>Rounds</Txt>
        <Txt v="caption" color="inkMuted">Progress of every round. Tap a round to open its standings and confirm qualifiers.</Txt>
      </View>
      {rows.map(({ round, category, scored, total, badge }, i) => {
        const head = i === 0 || rows[i - 1].category !== category ? <Txt key={`h-${round.id}`} v="overline" color="inkMuted" style={{ marginTop: space[2] }}>{category}</Txt> : null;
        const t = tone(badge);
        const label = badge === 'QUALIFIED' && round.advanceCount == null ? 'FINAL CONFIRMED' : badge === 'TIE' ? 'TIE ON LINE' : badge === 'SCORED' ? 'READY TO CONFIRM' : badge;
        const pct = total ? scored / total : 0;
        const unit = round.format === 'PK' ? 'bouts' : 'scored';
        return (
          <View key={round.id} style={{ gap: space[2] }}>
            {head}
            <Pressable accessibilityRole="button" accessibilityLabel={`${category} ${round.name}, ${scored} of ${total} ${unit}, ${label}`}
              onPress={() => router.push({ pathname: '/results', params: { round: round.id } })}
              style={({ pressed }) => [styles.row, { flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', backgroundColor: pressed ? c.surfaceRaised : c.surface, borderColor: badge === 'QUALIFIED' ? c.ok : c.hairline }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="label" style={{ fontSize: 16 }}>{round.name}</Txt>
                <Txt v="caption" color="inkMuted">{round.format === 'PK' ? 'PK' : 'Cut-off'} · {round.forms.map((f) => f.name).join(' + ')}</Txt>
              </View>
              <View style={{ width: wide ? 300 : '100%', gap: 6 }}>
                <Txt v="caption" color="inkMuted"><Txt v="label">{total ? `${scored}/${total} ${unit}` : 'Waiting for qualifiers'}</Txt> · {round.advanceCount != null ? `Top ${round.advanceCount} qualify` : 'Final · medals'}</Txt>
                <View style={[styles.track, { backgroundColor: c.surfaceSunken }]}><View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: badge === 'TIE' ? c.alert : c.ok }} /></View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], justifyContent: 'flex-end', minWidth: wide ? 170 : undefined }}>
                <View style={[styles.badge, { backgroundColor: t.bg, borderColor: badge === 'NOT STARTED' ? c.controlBorder : t.bg }]}>
                  {badge === 'QUALIFIED' ? <Icon name="check" size={12} color={t.fg} /> : null}
                  <Txt v="overline" color={t.fg} style={{ fontSize: 10 }}>{label}</Txt>
                </View>
                <Icon name="chevron" size={18} color={c.inkMuted} />
              </View>
            </Pressable>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  row: { gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1.5 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 24, borderRadius: 12, borderWidth: 1 },
});
