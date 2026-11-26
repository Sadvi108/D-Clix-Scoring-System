// Chief · History: finished games of a ring from GET /history (ring switch, search). Newest first.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { api, useSession } from '@/live';
import { ToneTag } from '@/features/chief/ToneTag';
import { historyRow } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { Icon, Txt } from '@/ui/primitives';

export default function History() {
  return <ChiefShell tab="history"><List /></ChiefShell>;
}

function List() {
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const p = useSession().profile;
  const params = useLocalSearchParams<{ ring?: string }>();
  const [ring, setRing] = useState<string | undefined>(params.ring ?? p?.ring ?? undefined);
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => setQ(typed.trim()), 400); return () => clearTimeout(t); }, [typed]);
  const { data, error } = usePolled(() => api.history({ ring, q, limit: 60 }), 10000, [ring, q]);
  const rows = data?.games.map(historyRow) ?? [];

  return (
    <>
      <Txt v="title" style={{ fontSize: 26 }}>History</Txt>
      <View style={[styles.tools, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(data?.rings ?? []).map((r) => {
            const on = r === (data?.ring ?? ring);
            return (
              <Pressable key={r} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setRing(r)}
                style={[styles.tab, { backgroundColor: on ? c.ink : c.surface, borderColor: on ? c.ink : c.controlBorder }]}>
                <Txt v="label" color={on ? c.surface : 'ink'}>Ring {r}</Txt>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.search, { borderColor: c.controlBorder, backgroundColor: c.surface }, wide && { marginLeft: 'auto', width: 340 }]}>
          <Icon name="list" size={16} color={c.inkMuted} />
          <TextInput value={typed} onChangeText={setTyped} placeholder="Search athlete, team or game no." placeholderTextColor={c.inkMuted}
            accessibilityLabel="Search finished games" autoCorrect={false} style={{ flex: 1, color: c.ink, fontSize: 15, minHeight: 44 }} />
          {typed ? <Pressable onPress={() => setTyped('')} accessibilityLabel="Clear search" hitSlop={8}><Icon name="close" size={16} color={c.inkMuted} /></Pressable> : null}
        </View>
      </View>
      <Notice text={error && !data ? error : null} />
      {!data ? <Txt v="body" color="inkMuted">Loading…</Txt> : rows.length === 0 ? (
        <View style={[styles.empty, { borderColor: c.controlBorder }]}>
          <Txt v="body" color="inkMuted">{q ? 'No finished games match the search.' : `No finished games on Ring ${data.ring} yet.`}</Txt>
        </View>
      ) : rows.map((g) => (
        <Pressable key={g.gameId} accessibilityRole="button" accessibilityLabel={`Game ${g.no}, ${g.tag.label}. Open details`}
          onPress={() => router.push({ pathname: '/chief/game/[id]', params: { id: g.gameId, ring: data.ring } })}
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceRaised : c.surface, borderColor: c.hairline }]}>
          <Txt v="scoreMd" style={{ width: wide ? 64 : 48, fontSize: wide ? 24 : 20 }}>{g.no}</Txt>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt v="label" numberOfLines={1}>{g.title}</Txt>
            <Txt v="caption" color="inkMuted" numberOfLines={1}>{g.sub}{g.winner ? ` · Winner: ${g.winner}` : ''}</Txt>
          </View>
          <ToneTag label={g.tag.label} tone={g.tag.tone} />
          <Icon name="chevron" size={18} color={c.inkMuted} />
        </Pressable>
      ))}
      {data ? <Txt v="caption" color="inkMuted">{data.total} finished on Ring {data.ring}</Txt> : null}
    </>
  );
}

const styles = StyleSheet.create({
  tools: { gap: space[3], alignItems: 'stretch' },
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: { minHeight: 44, minWidth: 64, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, padding: space[5] },
});
