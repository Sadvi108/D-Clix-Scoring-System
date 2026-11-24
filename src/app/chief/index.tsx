// Chief · All rings: one card per ring with its state, games done and left, who is online, and "Open this ring".
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { api, useScoring } from '@/data';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { RING_STATE_LABEL, ringCards, type RingCard } from '@/features/chief/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Notice } from '@/ui/console';
import { Button, Icon, Txt } from '@/ui/primitives';

export default function AllRings() {
  return <ChiefShell tab="rings"><Rings /></ChiefShell>;
}

function Rings() {
  const s = useScoring();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cols = width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  async function open(id: string) {
    setBusy(id); setErr(null);
    const r = await api.chooseRing(id);
    setBusy(null);
    if (r.ok) router.push('/referee'); else setErr(r.error);
  }
  return (
    <>
      <View style={{ gap: 2 }}>
        <Txt v="title" style={{ fontSize: 26 }}>All rings</Txt>
        <Txt v="caption" color="inkMuted">Live state of every ring. Open a ring to review and release its results.</Txt>
      </View>
      <Notice text={err} />
      <View style={styles.grid}>
        {ringCards(s).map((rc) => (
          <View key={rc.ring.id} style={{ width: cols === 1 ? '100%' : `${100 / cols - 2}%`, flexGrow: 1 }}>
            <Card rc={rc} busy={busy === rc.ring.id} disabled={!!busy} onOpen={() => open(rc.ring.id)} />
          </View>
        ))}
      </View>
    </>
  );
}

function Card({ rc, busy, disabled, onOpen }: { rc: RingCard; busy: boolean; disabled: boolean; onOpen: () => void }) {
  const { c } = useTheme();
  const tone = {
    SCORING: { bg: c.goldSoft, fg: c.goldText },
    WITH_RIC: { bg: c.chungSoft, fg: c.chungText },
    PAUSED: { bg: c.surfaceSunken, fg: c.ink },
    IDLE: { bg: 'transparent', fg: c.inkMuted },
  }[rc.state];
  const total = rc.done + rc.left;
  const pct = total ? rc.done / total : 0;
  const nothing = total === 0 && !rc.ring.operatorIn;
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: rc.current ? c.gold : c.hairline }]}>
      <View style={styles.head}>
        <Txt v="title" style={{ fontSize: 24 }}>{rc.ring.name}</Txt>
        <View style={[styles.pill, { backgroundColor: tone.bg, borderColor: rc.state === 'IDLE' ? c.controlBorder : tone.bg }]}>
          {rc.state === 'SCORING' ? <View style={[styles.dot, { backgroundColor: c.gold }]} /> : null}
          <Txt v="overline" color={tone.fg} style={{ fontSize: 10 }}>{RING_STATE_LABEL[rc.state]}</Txt>
        </View>
      </View>
      <Txt v="caption" color="inkMuted" numberOfLines={1}>{rc.note}{rc.current ? ' · open on this device' : ''}</Txt>
      <View style={[styles.track, { backgroundColor: c.surfaceSunken }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: rc.done }}>
        <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: c.ok, borderRadius: 4 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[5] }}>
        <Txt v="caption" color="inkMuted"><Txt v="scoreMd" style={{ fontSize: 24 }}>{rc.done}</Txt>  games done</Txt>
        <Txt v="caption" color="inkMuted"><Txt v="scoreMd" style={{ fontSize: 24 }}>{rc.left}</Txt>  left</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: space[4], flexWrap: 'wrap' }}>
        <View style={styles.who}><Icon name="flag" size={14} color={rc.ring.operatorIn ? c.okText : c.alertText} /><Txt v="caption" color={rc.ring.operatorIn ? 'okText' : 'alertText'}>Operator {rc.ring.operatorIn ? 'online' : 'offline'}</Txt></View>
        <View style={styles.who}><Icon name="users" size={14} color={rc.refOnline === rc.refTotal ? c.okText : c.goldText} /><Txt v="caption" color={rc.refOnline === rc.refTotal ? 'okText' : 'goldText'}>Referees {rc.refOnline} / {rc.refTotal} online</Txt></View>
      </View>
      <Button label={busy ? 'Opening…' : 'Open this ring'} icon="chevron" variant={rc.current ? 'primary' : 'secondary'} size="lg" block disabled={disabled || nothing} onPress={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4] },
  card: { borderRadius: radius.lg, borderWidth: 1.5, padding: space[5], gap: space[3] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 24, borderRadius: 12, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
