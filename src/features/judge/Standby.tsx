import { AUTO_SIGN_IN } from '@/config';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, useScoring } from '@/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { AthletePlate, MatchBar } from '@/ui/match';
import { usePkSides } from './sideLayout';
import { Button, Icon, StatusPill, Txt } from '@/ui/primitives';

export function Standby() {
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const next = s.current ?? s.queue.find((p) => p.status === 'QUEUED') ?? null;
  const later = s.queue.filter((p) => p.status === 'QUEUED' && p.id !== next?.id).slice(0, 2);
  const { left, right } = usePkSides();
  const isRotatePrompt = next?.format === 'PK' && !wide;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'bottom']}>
      <MatchBar onHome={() => router.replace('/')} matchNo={next?.matchNo} ring={s.ring.name} category={next?.category ?? 'No performance scheduled'} round={next?.round} judgeNo={s.me?.judgeNo} connection="online" compact={!wide} />
      <ScrollView contentContainerStyle={[styles.body, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={[styles.wait, { flex: wide ? 1 : undefined }]}>
          <View style={[styles.ring, { backgroundColor: c.surfaceRaised, borderColor: c.hairline }]}>
            <Icon name="clock" size={40} color={c.goldText} stroke={1.75} />
          </View>
          <Txt v="title" style={{ fontSize: 26, lineHeight: 32, textAlign: wide ? 'left' : 'center' }}>
            {s.current?.status === 'CALLED' || s.current?.status === 'ON_MAT' ? 'Athletes are on their way' : 'Waiting for the ring operator'}
          </Txt>
          <Txt v="body" color="inkMuted" style={{ textAlign: wide ? 'left' : 'center' }}>
            Scoring opens here the moment the operator starts the performance. Keep the screen on; you do not need to tap anything.
            {isRotatePrompt ? ' This is a PK bout: scoring opens in landscape, so turn your phone sideways.' : ''}
          </Txt>
          <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap', justifyContent: wide ? 'flex-start' : 'center' }}>
            <StatusPill status="online" detail="synced" />
            <StatusPill status="locked" label="Scoring closed" />
          </View>
        </View>
        {next ? (
          <View style={[styles.next, { backgroundColor: c.surface, borderColor: c.hairline, width: wide ? 380 : undefined }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt v="overline" color="inkMuted">{s.current ? 'On the mat' : 'Up next'}</Txt>
              <Txt v="label">Match {next.matchNo} · {next.form}</Txt>
            </View>
            {next.format === 'PK' && next.hong ? (
              <>
                <AthletePlate side={left} mirror={false} athlete={left === 'chung' ? next.chung : next.hong} showScores={false} compact />
                <Txt v="overline" color="inkMuted" style={{ textAlign: 'center' }}>vs</Txt>
                <AthletePlate side={right} mirror athlete={right === 'chung' ? next.chung : next.hong} showScores={false} compact />
              </>
            ) : (
              <AthletePlate side="solo" athlete={next.chung} tag={next.chung.entryId} showScores={false} compact />
            )}
            {later.length ? <Txt v="overline" color="inkMuted" style={{ marginTop: space[2] }}>Later on this ring</Txt> : null}
            {later.map((p) => (
              <View key={p.id} style={[styles.q, { backgroundColor: c.surfaceRaised }]}>
                <Txt v="label">Match {p.matchNo}</Txt>
                <Txt v="caption" color="inkMuted" numberOfLines={1} style={{ flexShrink: 1 }}>{p.category}</Txt>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.foot}>
        <Txt v="caption" color="inkMuted">Signed in as Judge {s.me?.judgeNo} · {s.me?.name}</Txt>
        {!AUTO_SIGN_IN ? <Button label="Sign out" icon="signout" variant="ghost" onPress={() => { api.signOut(); router.replace('/judge/sign-in'); }} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[4], gap: space[5], flexGrow: 1 },
  wait: { gap: space[3], justifyContent: 'center', alignItems: 'center', paddingVertical: space[4] },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  next: { borderRadius: radius.md, borderWidth: 1, padding: space[4], gap: space[2] },
  q: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3], padding: space[3], borderRadius: radius.sm },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[4] },
});
