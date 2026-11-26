// Venue display. Reads the public feed GET /display/{key} (no sign-in) every 1.5 s; the server only
// sends what spectators may see. The key comes from the console's TV link and is kept on this device.
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { toggleSides, usePkSides } from '@/features/judge/sideLayout';
import { api } from '@/live';
import { buildDisplayView, type DisplayAthlete, type DisplayResultLine } from '@/live/displayView';
import { asyncStorageKV } from '@/live/kvAsync';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, RuleBadge, Txt } from '@/ui/primitives';

const KEY = 'dclix.tvKey';

export default function Scoreboard() {
  useFreeOrientation();
  useKeepAwake();
  const params = useLocalSearchParams<{ key?: string }>();
  const [key, setKey] = useState<string | null>(params.key ?? null);
  const [ready, setReady] = useState(!!params.key);
  useEffect(() => {
    if (params.key) { void asyncStorageKV.set(KEY, params.key); return; }
    void asyncStorageKV.get(KEY).then((k) => { setKey(k); setReady(true); });
  }, [params.key]);
  const save = (k: string) => { void asyncStorageKV.set(KEY, k); setKey(k); };
  if (!ready) return null;
  if (!key) return <KeyForm onKey={save} />;
  return <Board tvKey={key} onKey={save} onForget={() => { void asyncStorageKV.remove(KEY); setKey(null); }} />;
}

function KeyForm({ onKey, note }: { onKey: (k: string) => void; note?: string }) {
  const router = useRouter();
  const { c } = useTheme();
  const [v, setV] = useState('');
  const key = v.trim().replace(/^.*\/display\//, '').replace(/\?.*$/, '');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground, alignItems: 'center', justifyContent: 'center', padding: space[5] }}>
      <View style={[styles.form, { backgroundColor: c.surface, borderColor: c.hairline }]}>
        <Txt v="title">Venue display</Txt>
        {note ? <Txt v="body" color="alertText">{note}</Txt> : null}
        <Txt v="body" color="inkMuted">Paste the TV link or its key. The operator or chief creates it in the console (TV link).</Txt>
        <TextInput value={v} onChangeText={setV} placeholder="https://…/display/KEY or KEY" placeholderTextColor={c.inkMuted} autoCapitalize="none" autoCorrect={false}
          accessibilityLabel="TV link or key" style={[styles.input, { borderColor: c.controlBorder, color: c.ink }]} />
        <Button label="Show the board" icon="tv" block disabled={!key} onPress={() => onKey(key)} />
        <Button label="Back" variant="secondary" block onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </SafeAreaView>
  );
}

function Board({ tvKey, onKey, onForget }: { tvKey: string; onKey: (k: string) => void; onForget: () => void }) {
  const router = useRouter();
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const big = width > 900;
  const { left } = usePkSides();
  const { data, error, at } = usePolled(async () => {
    try {
      return await api.display(tvKey);
    } catch (e) {
      // An old or wrong key: name it by its code so the screen can ask for a new one.
      if (e instanceof ApiError && e.code === 'NOT_FOUND') throw new Error('NOT_FOUND');
      throw e;
    }
  }, 1500, [tvKey]);
  const [now, setNow] = useState(() => Date.now());
  const running = !!data?.current?.clock?.running;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);
  const gone = error && /not.?found|NOT_FOUND/i.test(error);
  if (gone) return <KeyForm note="This TV key no longer works. Create a new TV link in the console." onKey={onKey} />;
  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.ground, alignItems: 'center', justifyContent: 'center', gap: space[3] }}>
        <Txt v="heading" color="inkMuted">{error ?? 'Connecting to the venue feed…'}</Txt>
        <Button label="Change key" variant="secondary" onPress={onForget} />
      </SafeAreaView>
    );
  }
  const v = buildDisplayView(data, Math.max(0, now - at));
  const pk = v.kind === 'PK';
  const athletes = pk && left === 'hong' ? [...v.athletes].reverse() : v.athletes;
  const resultLines = v.result ? (pk && left === 'hong' ? [...v.result.athletes].reverse() : v.result.athletes) : [];

  const plate = (a: DisplayAthlete, mirror: boolean) => {
    const red = a.corner === 'RED';
    return (
      <View key={a.corner + a.name} style={[styles.half, { backgroundColor: red ? c.hongSoft : c.chungSoft, alignItems: mirror ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.tag, { backgroundColor: red ? c.hong : c.chung }]}><Txt v="overline" color="#ffffff">{a.corner === 'SOLO' ? 'Athlete' : red ? 'HONG' : 'CHUNG'}</Txt></View>
        <Txt v="title" numberOfLines={2} style={{ textTransform: 'uppercase', fontSize: big ? 40 : 26, lineHeight: big ? 46 : 32, textAlign: mirror ? 'right' : 'left' }}>{a.name}</Txt>
        {a.team ? <Txt v="heading" color="inkMuted">{a.team}</Txt> : null}
        {a.members?.length ? <Txt v="label" color="inkMuted">{a.members.join(' · ')}</Txt> : null}
      </View>
    );
  };
  const resultPlate = (a: DisplayResultLine, mirror: boolean) => {
    const red = a.corner === 'RED';
    return (
      <View key={a.corner + a.name} style={[styles.half, { backgroundColor: red ? c.hongSoft : c.chungSoft, alignItems: mirror ? 'flex-end' : 'flex-start' }]}>
        <View style={{ flexDirection: mirror ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
          <View style={[styles.tag, { backgroundColor: red ? c.hong : c.chung }]}><Txt v="overline" color="#ffffff">{a.corner === 'SOLO' ? 'Athlete' : red ? 'HONG' : 'CHUNG'}</Txt></View>
          {a.winner ? <View style={[styles.tag, { backgroundColor: c.gold, flexDirection: 'row', gap: 4, alignItems: 'center' }]}><Icon name="flag" size={12} color={c.onGold} /><Txt v="overline" color="onGold">Winner</Txt></View> : null}
          {a.rank ? <Txt v="label" color="inkMuted">Rank {a.rank}</Txt> : null}
        </View>
        <Txt v="title" numberOfLines={1} style={{ textTransform: 'uppercase', fontSize: big ? 34 : 24 }}>{a.name}</Txt>
        <Txt v="scoreHero" color="goldText" style={{ fontSize: big ? 88 : 56, lineHeight: big ? 90 : 58 }}>{a.total}</Txt>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <View style={[styles.bar, { backgroundColor: c.surface, borderBottomColor: c.hairline }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Leave the venue display" hitSlop={10}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surfaceRaised : 'transparent' })}>
            <Icon name="menu" size={22} color={c.inkMuted} />
          </Pressable>
          <Txt v="label" color="inkMuted">Ring {v.ring}</Txt>
          <Txt v="scoreLg" style={{ fontSize: 30 }}>{v.gameNo || '—'}</Txt>
        </View>
        <View style={{ flexShrink: 1, alignItems: 'center' }}>
          <Txt v="title" numberOfLines={1}>{v.title}</Txt>
          {v.sub ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{v.sub}</Txt> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
          {pk ? <Button icon="swap" variant="secondary" accessibilityLabel="Swap Chung and Hong sides" onPress={toggleSides} style={{ minHeight: 40, paddingHorizontal: 10 }} /> : null}
          <RuleBadge tone="draft" label="UAT" />
        </View>
      </View>

      {v.showResult ? (
        <View style={[styles.halves, { flexDirection: resultLines.length > 1 && width > height ? 'row' : 'column' }]}>
          {resultLines.map((a, i) => resultPlate(a, resultLines.length > 1 && i === 1))}
        </View>
      ) : v.idle ? (
        <View style={styles.idle}>
          <Txt v="scoreHero" style={{ fontSize: big ? 64 : 40, lineHeight: big ? 64 : 44, textAlign: 'center' }}>D-Clix Scoring System</Txt>
          <Txt v="heading" color="inkMuted">Ring {v.ring} · waiting for the next game</Txt>
          {v.next ? <Txt v="heading">Next: {v.next}</Txt> : null}
        </View>
      ) : (
        <View style={[styles.halves, { flexDirection: athletes.length > 1 && width > height ? 'row' : 'column' }]}>
          {athletes.map((a, i) => plate(a, athletes.length > 1 && i === 1))}
        </View>
      )}

      <View style={[styles.foot, { backgroundColor: c.surface, borderTopColor: c.hairline }]}>
        <Txt v="overline" color="inkMuted">{v.showResult && v.result ? `Result · ${v.result.title}` : v.next && !v.idle ? `Next: ${v.next}` : ''}</Txt>
        <Txt v="scoreHero" color={v.clock.running ? 'goldText' : 'ink'} style={{ fontSize: 40, lineHeight: 42 }}>{v.idle ? '' : v.clock.text}</Txt>
        <Txt v="overline" color="inkMuted">{v.modeLabel}</Txt>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  form: { width: '100%', maxWidth: 520, borderRadius: radius.lg, borderWidth: 1, padding: space[5], gap: space[3] },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space[3], fontSize: 16 },
  bar: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], borderBottomWidth: 1, gap: space[3] },
  halves: { flex: 1 },
  half: { flex: 1, padding: space[6], gap: space[3], justifyContent: 'center' },
  tag: { height: 26, paddingHorizontal: 10, borderRadius: radius.sm, justifyContent: 'center' },
  idle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[5] },
  foot: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], borderTopWidth: 1 },
});
