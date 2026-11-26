// Chief · All rings: one card per ring from GET /rings/overview (every 3 s): state, current game,
// games done and left, who is online, and "Open this ring" (claims the ring, then the console).
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { ApiError } from '@/api/client';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { afterClaim, api, session, useSession } from '@/live';
import { overviewCards, type RingCard, type Tone } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { confirm } from '@/ui/confirm';
import { Notice } from '@/ui/console';
import { Button, Icon, Txt } from '@/ui/primitives';

export default function AllRings() {
  return <ChiefShell tab="rings"><Rings /></ChiefShell>;
}

function Rings() {
  const router = useRouter();
  const p = useSession().profile;
  const { width } = useWindowDimensions();
  const { data, error } = usePolled(() => api.overview(), 3000, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cols = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  async function open(ring: string) {
    if (p?.ring && p.ring.toUpperCase() !== ring.toUpperCase()) {
      const yes = await confirm({ title: 'Change ring?', message: `Move from Ring ${p.ring} to Ring ${ring}?`, ok: 'Move', cancel: 'Cancel' });
      if (!yes) return;
    }
    setBusy(ring); setErr(null);
    try {
      if (!p?.ring || p.ring.toUpperCase() !== ring.toUpperCase()) { await session.claim(ring); afterClaim(); }
      router.dismissTo('/referee');
    } catch (e) {
      if (!session.handleError(e)) setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const cards = data ? overviewCards(data, p?.ring ?? null) : [];
  return (
    <>
      <View style={{ gap: 2 }}>
        <Txt v="title" style={{ fontSize: 26 }}>All rings</Txt>
        <Txt v="caption" color="inkMuted">{data ? `Game day ${data.date} · updates every 3 s.` : 'Loading…'} Open a ring to run its console.</Txt>
      </View>
      <Notice text={err ?? (error && !data ? error : null)} />
      <View style={styles.grid}>
        {cards.map((rc) => (
          <View key={rc.ring} style={{ width: cols === 1 ? '100%' : `${100 / cols - 2}%`, flexGrow: 1 }}>
            <Card rc={rc} busy={busy === rc.ring} disabled={!!busy} onOpen={() => void open(rc.ring)} onHistory={() => router.push({ pathname: '/chief/history', params: { ring: rc.ring } })} />
          </View>
        ))}
      </View>
      {data && !cards.length ? <Txt v="body" color="inkMuted">No rings on this game day.</Txt> : null}
    </>
  );
}

function Card({ rc, busy, disabled, onOpen, onHistory }: { rc: RingCard; busy: boolean; disabled: boolean; onOpen: () => void; onHistory: () => void }) {
  const { c } = useTheme();
  const tone: Record<Tone, { bg: string; fg: string }> = {
    ok: { bg: c.okSoft, fg: c.okText }, warn: { bg: c.goldSoft, fg: c.goldText }, bad: { bg: c.alertSoft, fg: c.alertText }, idle: { bg: 'transparent', fg: c.inkMuted },
  };
  const t = tone[rc.tone];
  const op = rc.operator === 'online' ? { text: 'Operator online', color: 'okText' as const } : rc.operator === 'offline' ? { text: 'Operator offline', color: 'alertText' as const } : { text: 'No operator', color: 'inkMuted' as const };
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: rc.mine ? c.gold : c.hairline }]}>
      <View style={styles.head}>
        <Txt v="title" style={{ fontSize: 24 }}>Ring {rc.ring}</Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {rc.tie ? <View style={[styles.pill, { backgroundColor: c.alertSoft, borderColor: c.alertSoft }]}><Txt v="overline" color="alertText" style={{ fontSize: 10 }}>Tie</Txt></View> : null}
          <View style={[styles.pill, { backgroundColor: t.bg, borderColor: rc.tone === 'idle' ? c.controlBorder : t.bg }]}>
            {rc.tone === 'ok' ? <View style={[styles.dot, { backgroundColor: c.ok }]} /> : null}
            <Txt v="overline" color={t.fg} style={{ fontSize: 10 }}>{rc.state}</Txt>
          </View>
        </View>
      </View>
      {rc.game ? <Txt v="label" numberOfLines={1}>{rc.game}</Txt> : null}
      <Txt v="caption" color="inkMuted" numberOfLines={1}>{rc.detail}{rc.mine ? ' · open on this tablet' : ''}</Txt>
      <View style={[styles.track, { backgroundColor: c.surfaceSunken }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: rc.pct }}>
        <View style={{ width: `${rc.pct}%`, height: '100%', backgroundColor: c.ok, borderRadius: 4 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: space[5] }}>
        <Txt v="caption" color="inkMuted"><Txt v="scoreMd" style={{ fontSize: 24 }}>{rc.done}</Txt>  games done</Txt>
        <Txt v="caption" color="inkMuted"><Txt v="scoreMd" style={{ fontSize: 24 }}>{rc.left}</Txt>  left</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: space[4], flexWrap: 'wrap' }}>
        <View style={styles.who}><Icon name="flag" size={14} color={c[op.color]} /><Txt v="caption" color={op.color}>{op.text}</Txt></View>
        <View style={styles.who}><Icon name="users" size={14} color={c.inkMuted} /><Txt v="caption" color="inkMuted">Referees {rc.judgesOnline} online / {rc.judgesSignedIn} signed in</Txt></View>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}><Button label={busy ? 'Opening…' : rc.mine ? 'Back to ring' : 'Open ring'} icon="chevron" variant={rc.mine ? 'primary' : 'secondary'} size="lg" block disabled={disabled} onPress={onOpen} /></View>
        <Button icon="list" accessibilityLabel={`History of Ring ${rc.ring}`} variant="secondary" size="lg" onPress={onHistory} />
      </View>
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
