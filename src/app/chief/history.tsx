// Chief · History: finished games per ring (tabs) with search. Each row: game no., athletes, outcome, tag.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useScoring } from '@/data';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { gameOutcome, gameTag, gameWinner, hms } from '@/features/chief/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Icon, Txt } from '@/ui/primitives';
import { TagPill } from '@/features/chief/TagPill';

export default function History() {
  return <ChiefShell tab="history"><List /></ChiefShell>;
}

function List() {
  const s = useScoring();
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const { ring } = useLocalSearchParams<{ ring?: string }>();
  const [ringId, setRingId] = useState(ring && s.rings.some((r) => r.id === ring) ? ring : s.ring.id);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = s.history.filter((g) => g.ringId === ringId).slice().reverse()
    .filter((g) => !needle || [g.performance.matchNo, g.performance.chung.name, g.performance.hong?.name ?? '', g.performance.chung.nat, g.performance.hong?.nat ?? ''].some((x) => x.toLowerCase().includes(needle)));

  return (
    <>
      <Txt v="title" style={{ fontSize: 26 }}>History</Txt>
      <View style={[styles.tools, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {s.rings.map((r) => {
            const on = r.id === ringId;
            const n = s.history.filter((g) => g.ringId === r.id).length;
            return (
              <Pressable key={r.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setRingId(r.id)}
                style={[styles.tab, { backgroundColor: on ? c.ink : c.surface, borderColor: on ? c.ink : c.controlBorder }]}>
                <Txt v="label" color={on ? c.surface : 'ink'}>{r.name.replace('Ring ', '')}</Txt>
                <Txt v="caption" color={on ? c.surface : 'inkMuted'}>{n}</Txt>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.search, { borderColor: c.controlBorder, backgroundColor: c.surface }, wide && { marginLeft: 'auto', width: 340 }]}>
          <Icon name="list" size={16} color={c.inkMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search athlete, country or game no." placeholderTextColor={c.inkMuted}
            accessibilityLabel="Search finished games" autoCorrect={false} style={{ flex: 1, color: c.ink, fontSize: 15, minHeight: 44 }} />
          {q ? <Pressable onPress={() => setQ('')} accessibilityLabel="Clear search" hitSlop={8}><Icon name="close" size={16} color={c.inkMuted} /></Pressable> : null}
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={[styles.empty, { borderColor: c.controlBorder }]}>
          <Txt v="body" color="inkMuted">{needle ? 'No finished games match the search.' : 'No finished games on this ring yet. Games appear here once released, declared or decided by walkover.'}</Txt>
        </View>
      ) : rows.map((g) => {
        const p = g.performance;
        const win = gameWinner(g);
        const tag = gameTag(g);
        return (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Game ${p.matchNo}, ${tag}. Open details`} onPress={() => router.push({ pathname: '/chief/game/[id]', params: { id: p.id } })}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceRaised : c.surface, borderColor: c.hairline }]}>
            <Txt v="scoreMd" style={{ width: wide ? 64 : 48, fontSize: wide ? 24 : 20 }}>{p.matchNo}</Txt>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              {p.hong ? (
                <Txt v="label" numberOfLines={1}>
                  <Txt v="label" color="chungText" style={win === 'chung' ? { textDecorationLine: 'underline' } : null}>{p.chung.name}</Txt>
                  <Txt v="label" color="inkMuted">  vs  </Txt>
                  <Txt v="label" color="hongText" style={win === 'hong' ? { textDecorationLine: 'underline' } : null}>{p.hong.name}</Txt>
                </Txt>
              ) : <Txt v="label" color="chungText" numberOfLines={1}>{p.chung.name}</Txt>}
              <Txt v="caption" color="inkMuted" numberOfLines={1}>{p.format === 'PK' ? 'PK' : 'Cut-off'} · {p.category} · {p.round} · {p.form}{p.format === 'CUTOFF' && p.formCount > 1 ? ` (F${p.formNo})` : ''} · {hms(g.finishedAt)}</Txt>
              {!wide ? <Txt v="caption" color="ink" numberOfLines={1}>{gameOutcome(s, g)}</Txt> : null}
            </View>
            {wide ? <Txt v="body" numberOfLines={1} style={{ width: 240 }}>{gameOutcome(s, g)}</Txt> : null}
            <TagPill tag={tag} />
            <Icon name="chevron" size={18} color={c.inkMuted} />
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  tools: { gap: space[3], alignItems: 'stretch' },
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: { minHeight: 44, minWidth: 64, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: space[5] },
});
