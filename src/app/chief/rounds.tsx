// Chief · Rounds from GET /rounds: head-to-head categories with their games (tap → game detail) and the
// cut-off rounds (tap → ranking and "Confirm qualifiers").
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { ToneTag } from '@/features/chief/ToneTag';
import { api } from '@/live';
import { roundsView } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { Icon, Txt } from '@/ui/primitives';

export default function Rounds() {
  return <ChiefShell tab="rounds"><List /></ChiefShell>;
}

function List() {
  const router = useRouter();
  const { c } = useTheme();
  const { data, error } = usePolled(() => api.rounds(), 10000, []);
  const v = data ? roundsView(data) : null;
  const row = (key: string, title: string, sub: string, onPress: () => void, right?: React.ReactNode, pct?: number) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceRaised : c.surface, borderColor: c.hairline }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Txt v="label" style={{ fontSize: 16 }}>{title}</Txt>
        <Txt v="caption" color="inkMuted">{sub}</Txt>
        {pct != null ? <View style={[styles.track, { backgroundColor: c.surfaceSunken }]}><View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.ok }} /></View> : null}
      </View>
      {right}
      <Icon name="chevron" size={18} color={c.inkMuted} />
    </Pressable>
  );
  return (
    <>
      <View style={{ gap: 2 }}>
        <Txt v="title" style={{ fontSize: 26 }}>Rounds</Txt>
        <Txt v="caption" color="inkMuted">{data ? `Game day ${data.date}. ` : ''}Tap a cut-off round for its ranking, or a PK game for its details.</Txt>
      </View>
      <Notice text={error && !data ? error : null} />
      {!v ? <Txt v="body" color="inkMuted">Loading…</Txt> : v.empty ? <Txt v="body" color="inkMuted">No rounds on this game day.</Txt> : null}
      {v?.pk.map((grp) => (
        <View key={grp.title} style={{ gap: space[2] }}>
          <Txt v="overline" color="inkMuted" style={{ marginTop: space[2] }}>{grp.title}</Txt>
          {grp.games.map((g) => row(g.gameId + (g.ring ?? ''), g.title, g.sub, () => router.push({ pathname: '/chief/game/[id]', params: g.ring ? { id: g.gameId, ring: g.ring } : { id: g.gameId } })))}
        </View>
      ))}
      {v?.rounds.length ? <Txt v="overline" color="inkMuted" style={{ marginTop: space[2] }}>Cut-off rounds</Txt> : null}
      {v?.rounds.map((r) => row(String(r.roundId), r.title, r.sub, () => router.push({ pathname: '/results', params: { round: String(r.roundId) } }),
        r.decided ? <ToneTag label="Qualified" tone="ok" /> : null, r.pct))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1.5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
});
