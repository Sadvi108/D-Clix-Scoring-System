import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { MatchBar } from '@/ui/match';
import { Icon, StatusPill, Txt } from '@/ui/primitives';
import type { JudgeModel } from './model';

/** Nothing to score yet (or a game scored another way): who we are waiting for and which games come next. */
export function Standby({ j }: { j: JudgeModel }) {
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const v = j.view;
  const other = v.mode === 'other';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'bottom']}>
      <MatchBar onHome={() => router.push('/ring-status')} matchNo={v.gameNo || undefined} ring={`Ring ${v.ring}`} category={v.category || 'No performance scheduled'} round={v.round || undefined} judgeNo={v.seat ?? undefined} connection={v.conn ? 'online' : 'offline'} compact={!wide} />
      <ScrollView contentContainerStyle={[styles.body, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={[styles.wait, { flex: wide ? 1 : undefined }]}>
          <View style={[styles.ring, { backgroundColor: c.surfaceRaised, borderColor: c.hairline }]}>
            <Icon name="clock" size={40} color={c.goldText} stroke={1.75} />
          </View>
          <Txt v="title" style={{ fontSize: 26, lineHeight: 32, textAlign: wide ? 'left' : 'center' }}>
            {other && v.notice ? v.notice.text : 'Waiting for the ring operator'}
          </Txt>
          <Txt v="body" color="inkMuted" style={{ textAlign: wide ? 'left' : 'center' }}>
            Scoring opens here the moment the operator starts the performance. Keep the screen on; you do not need to tap anything.
          </Txt>
          <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap', justifyContent: wide ? 'flex-start' : 'center' }}>
            <StatusPill status={v.conn ? 'online' : 'offline'} detail={v.conn ? 'synced' : undefined} />
            <StatusPill status="locked" label="Scoring closed" />
          </View>
        </View>
        {v.next.length ? (
          <View style={[styles.next, { backgroundColor: c.surface, borderColor: c.hairline, width: wide ? 380 : undefined }]}>
            <Txt v="overline" color="inkMuted">Up next</Txt>
            {v.next.map((g) => (
              <View key={g.gameNo} style={[styles.q, { backgroundColor: c.surfaceRaised }]}>
                <Txt v="label">Game {g.gameNo} · {g.label}</Txt>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[4], gap: space[5], flexGrow: 1 },
  wait: { gap: space[3], justifyContent: 'center', alignItems: 'center', paddingVertical: space[4] },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  next: { borderRadius: radius.md, borderWidth: 1, padding: space[4], gap: space[2] },
  q: { flexDirection: 'row', justifyContent: 'space-between', gap: space[3], padding: space[3], borderRadius: radius.sm },
});
