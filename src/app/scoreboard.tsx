import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Athlete, Side } from '@/core/types';
import { useScoring } from '@/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { mmss } from '@/ui/match';
import { ScoreboardRow } from '@/ui/officials';
import { Button, Icon, RuleBadge, Txt } from '@/ui/primitives';
import { toggleSides, usePkSides } from '@/features/judge/sideLayout';
import { isFreestyle } from '@/sports/poomsae/rules';

/** Venue display. Shows only RELEASED figures; before release it shows the call-up or the live clock. */
export default function Scoreboard() {
  useFreeOrientation();
  useKeepAwake();
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { width, height } = useWindowDimensions();
  const cur = s.current;
  const r = s.result;
  const showResult = s.display === 'RESULT' && !!r?.released;
  const pk = cur?.format === 'PK';
  const { left, right } = usePkSides();
  const sides: Side[] = pk ? [left, right] : ['chung'];
  const rowH = Math.max(34, Math.min(56, Math.floor((height - 260) / Math.max(1, s.submissions.length))));
  const big = width > 900;

  const half = (sd: Side, a: Athlete) => {
    const res = r?.sides[sd];
    const mirror = pk && sd === right; // the half on the right of this screen reads right-to-left
    const won = pk && r?.winner === sd;
    const subs = [...s.submissions].sort((x, y) => x.judgeNo - y.judgeNo);
    return (
      <View key={sd} style={[styles.half, { backgroundColor: sd === 'hong' ? c.hongSoft : c.chungSoft }]}>
        <View style={[styles.who, mirror && { flexDirection: 'row-reverse' }]}>
          <View style={{ flex: 1, minWidth: 0, alignItems: mirror ? 'flex-end' : 'flex-start', gap: 4 }}>
            <View style={{ flexDirection: mirror ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }}>
              <View style={[styles.tag, { backgroundColor: sd === 'hong' ? c.hong : c.chung }]}>
                <Txt v="overline" color="#ffffff">{pk ? sd.toUpperCase() : a.entryId}</Txt>
              </View>
              <Txt v="label" color="inkMuted">{a.nat}</Txt>
              {won && showResult ? (
                <View style={[styles.tag, { backgroundColor: c.gold, flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                  <Icon name="flag" size={12} color={c.onGold} /><Txt v="overline" color="onGold">Winner</Txt>
                </View>
              ) : null}
            </View>
            <Txt v="title" numberOfLines={1} style={{ textTransform: 'uppercase', fontSize: big ? 34 : 24, lineHeight: big ? 40 : 30 }}>{a.name}</Txt>
            {a.members?.length ? <Txt v="label" color="inkMuted" numberOfLines={1}>{a.members.join(' · ')}</Txt> : null}
          </View>
          {showResult && res ? (
            <View style={{ alignItems: mirror ? 'flex-start' : 'flex-end' }}>
              <Txt v="overline" color="inkMuted">Final score</Txt>
              <Txt v="scoreHero" color="goldText" style={{ fontSize: big ? 72 : 48, lineHeight: big ? 72 : 50 }}>{res.final.toFixed(4)}</Txt>
            </View>
          ) : null}
        </View>
        {showResult ? (
          <ScrollView contentContainerStyle={{ gap: 6 }} showsVerticalScrollIndicator={false}>
            {subs.map((sub) => (
              <ScoreboardRow key={sub.judgeNo} side={pk ? sd : 'chung'} mirror={mirror} judgeNo={sub.judgeNo} accuracy={sub.sides[sd]?.accuracy ?? null} presentation={sub.sides[sd]?.presentation ?? null}
                excluded={res?.excludedHigh === sub.judgeNo ? 'high' : res?.excludedLow === sub.judgeNo ? 'low' : null} height={rowH} />
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <View style={[styles.bar, { backgroundColor: c.surface, borderBottomColor: c.hairline }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Back to role menu" hitSlop={10}
            style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.surfaceRaised : 'transparent' })}>
            <Icon name="menu" size={22} color={c.inkMuted} />
          </Pressable>
          <Txt v="scoreLg" style={{ fontSize: 30 }}>{cur?.matchNo ?? '—'}</Txt>
        </View>
        <Txt v="title" numberOfLines={1} style={{ flexShrink: 1 }}>{cur?.category ?? s.ring.name}</Txt>
        <View style={{ flexDirection: 'row', gap: space[3], alignItems: 'center' }}>
          {pk ? <Button icon="swap" variant="secondary" accessibilityLabel="Swap Chung and Hong sides" onPress={toggleSides} style={{ minHeight: 40, paddingHorizontal: 10 }} /> : null}
          {cur && isFreestyle(s.rules) ? <RuleBadge tone="draft" label="Freestyle" /> : null}
          <RuleBadge tone="draft" label="UAT" />
          <Txt v="label" color="inkMuted">{cur?.round ?? ''}</Txt>
        </View>
      </View>

      {!cur ? (
        <View style={styles.idle}>
          <Txt v="scoreHero" style={{ fontSize: 64, lineHeight: 64 }}>D-Clix Scoring System</Txt>
          <Txt v="heading" color="inkMuted">{s.ring.name} · waiting for the next bout</Txt>
        </View>
      ) : (
        <View style={[styles.halves, { flexDirection: pk && width > height ? 'row' : 'column' }]}>
          {sides.map((sd) => half(sd, sd === 'hong' ? cur.hong! : cur.chung))}
        </View>
      )}

      <View style={[styles.foot, { backgroundColor: c.surface, borderTopColor: c.hairline }]}>
        <Txt v="heading" style={{ letterSpacing: 2, textTransform: 'uppercase' }}><Txt v="overline" color="inkMuted">Form {cur?.formNo ?? 1}  </Txt>{cur?.form ?? ''}</Txt>
        <Txt v="scoreHero" color={cur?.clockRunning ? 'goldText' : 'ink'} style={{ fontSize: 40, lineHeight: 42 }}>{mmss(cur?.clockSec ?? 0)}</Txt>
        {showResult ? <RuleBadge tone="released" label="Released" /> : <Txt v="overline" color="inkMuted">{s.display === 'LIVE' ? 'Scoring in progress' : 'Call-up'}</Txt>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], borderBottomWidth: 1, gap: space[3] },
  halves: { flex: 1 },
  half: { flex: 1, padding: space[5], gap: space[3] },
  who: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  tag: { height: 24, paddingHorizontal: 8, borderRadius: radius.sm, justifyContent: 'center' },
  idle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] },
  foot: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[5], borderTopWidth: 1 },
});
