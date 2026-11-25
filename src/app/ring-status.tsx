// Live status: proves the API connection end to end until the work screens move to the API
// (Plans 2 and 3). Shows who is signed in, the link, the current game, the seats, the queue and
// the outbox. Stays afterwards as a diagnostics page reachable from Device connection.
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { session, texts, useLive, useOutbox, useRingNeeded, useSession } from '@/live';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Txt } from '@/ui/primitives';

const hms = (ms: number) => (ms ? new Date(ms).toTimeString().slice(0, 8) : '—');

export default function RingStatus() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const sess = useSession();
  const live = useLive();
  const box = useOutbox();
  const need = useRingNeeded();
  const t = texts.t;

  useEffect(() => { if (need.needed) router.replace('/rings'); }, [need.needed, router]);
  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;

  const p = sess.profile;
  const st = live.state;
  const cur = st?.current;
  const row = (k: string, v: string | number | null | undefined) => (
    <View style={styles.kv} key={k}><Txt v="caption" color="inkMuted" style={{ width: 150 }}>{k}</Txt><Txt v="label" style={{ flex: 1 }}>{v == null || v === '' ? '—' : String(v)}</Txt></View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <View style={[styles.dot, { backgroundColor: live.conn ? c.ok : c.alert }]} />
          <Txt v="title" style={{ flex: 1 }}>{t('ring', 'Ring')} {p.ring} {p.seat ? `· J${p.seat}` : ''}</Txt>
          <Button label={t('wl_ring_seat', 'Ring / seat')} variant="secondary" onPress={() => router.push('/rings')} />
          <Button label={t('sign_out', 'Sign out')} icon="signout" variant="secondary" onPress={() => { void session.logout().then(() => router.replace('/sign-in')); }} />
        </View>
        <Txt v="caption" color={live.conn ? 'inkMuted' : 'alertText'}>
          {live.conn ? t('hb_online', 'Online') : t('offline_banner_staff', 'Offline')} · {t('last_sync', 'Last sync')} {hms(live.lastSync)}
        </Txt>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt v="overline" color="inkMuted">Signed in</Txt>
          {row('Name', p.name)}
          {row('Role', p.role)}
          {row('Tournament', p.tournament.name)}
          {row('Date', p.date)}
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt v="overline" color="inkMuted">Current game</Txt>
          {!st ? <Txt v="body" color="inkMuted">{t('wl_loading', 'Loading…')}</Txt> : !cur ? <Txt v="body" color="inkMuted">{t('wl_no_game', 'No game on the mat')}</Txt> : (
            <>
              {row('Game', `${cur.gameNo} (${cur.gameId})`)}
              {row('Kind', `${cur.kind}${cur.free ? ' · Freestyle' : ''} · ${cur.method}`)}
              {row('Stage', `${cur.stage}${cur.waiting ? ` · ${cur.waiting}` : ''}`)}
              {row('Scoring open', cur.scoringOpen ? 'yes' : 'no')}
              {row('Form', `${cur.formNo ?? '—'} of ${cur.forms.length} · ${cur.forms.find((f) => f.formNo === cur.formNo)?.name ?? ''}`)}
              {row('Clock', cur.clock ? `${cur.clock.state} · ${cur.clock.remainingMs != null ? Math.ceil(cur.clock.remainingMs / 1000) + ' s left' : Math.floor(cur.clock.elapsedMs / 1000) + ' s'}` : null)}
              {row('Athletes', cur.athletes.map((a) => `${a.corner} ${a.name}${a.team ? ` (${a.team})` : ''}`).join(' · '))}
              {cur.my ? row('My score', cur.my.sent ? 'sent' : cur.my.draft?.length ? 'draft saved' : 'not started') : null}
              {cur.submissions ? row('Judges sent', `${cur.submissions.sent} / ${cur.submissions.total}`) : null}
            </>
          )}
        </View>

        {st?.seats?.length ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
            <Txt v="overline" color="inkMuted">Seats</Txt>
            {st.seats.map((s) => row(`J${s.seat}`, `${s.online ? 'online' : 'offline'}${s.status ? ` · ${s.status}` : ''}${s.unsent ? ` · ${s.unsent} unsent` : ''}${s.device ? ` · ${s.device}` : ''}`))}
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt v="overline" color="inkMuted">Queue and outbox</Txt>
          {row('Previous', st?.previous?.length ?? 0)}
          {row('Next', (st?.next ?? st?.queue ?? []).map((g) => g.gameNo).join(', '))}
          {row('Display mode', st?.display?.mode)}
          {row('Scores waiting to send', box.jobs.length)}
          {row('State version', st?.version)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[5], gap: space[4], maxWidth: 900, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: 6 },
  kv: { flexDirection: 'row', gap: space[3], alignItems: 'baseline' },
});
