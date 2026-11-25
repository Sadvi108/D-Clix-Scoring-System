// Choose your ring (GET /rings). Judges tap a free seat; operator and chief open a ring.
// Leaving a ring or seat already held asks first, so a stray tap never moves anyone.
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import type { Rings } from '@/api/types';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { afterClaim, api, session, texts, useSession } from '@/live';
import { homeFor } from '@/live/routes';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { confirm } from '@/ui/confirm';
import { Button, Icon, RuleBadge, Txt } from '@/ui/primitives';

const ROLE_KEY = { JUDGE: ['role_JUDGE', 'Judge'], OPERATOR: ['role_OPERATOR', 'Ring operator'], CHIEF: ['role_CHIEF', 'Chief referee'] } as const;

export default function RingsScreen() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const sess = useSession();
  const t = texts.t;
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const [rings, setRings] = useState<Rings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await api.rings(); setRings(r); setErr(null); } catch (e) { if (!session.handleError(e)) setErr(e instanceof ApiError ? e.message : String(e)); }
  }, []);
  useEffect(() => {
    let live = true;
    api.rings().then(
      (r) => { if (live) { setRings(r); setErr(null); } },
      (e) => { if (live && !session.handleError(e)) setErr(e instanceof ApiError ? e.message : String(e)); },
    );
    return () => { live = false; };
  }, []);

  if (sess.status === 'booting') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ground }}>
        <ActivityIndicator color={c.gold} />
      </View>
    );
  }
  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;
  const p = sess.profile;
  const where = (r: string, s?: number | null) => `${t('ring', 'Ring')} ${r}${s ? ` · J${s}` : ''}`;

  async function claim(ring: string, seat?: number) {
    const k = `${ring}-${seat ?? ''}`;
    setBusy(k); setErr(null);
    try {
      const prof = await session.claim(ring, seat);
      afterClaim();
      router.replace(homeFor(prof));
    } catch (e) {
      if (!session.handleError(e)) setErr(e instanceof ApiError ? e.message : String(e));
      void load();
    } finally {
      setBusy(null);
    }
  }

  async function ask(ring: string, seat?: number) {
    const same = p.ring && p.ring.toUpperCase() === ring.toUpperCase() && ((p.seat == null && !seat) || (seat != null && p.seat === seat));
    if (!p.ring || same) { void claim(ring, seat); return; }
    const yes = await confirm({
      title: t('wl_chg_q', 'Change ring?'),
      message: t('wl_chg_text', 'Move from {from} to {to}?', { from: where(p.ring, p.seat), to: where(ring, seat) }),
      ok: t('wl_chg_ok', 'Move'),
      cancel: t('cancel', 'Cancel'),
    });
    if (yes) void claim(ring, seat);
  }

  async function signOut() {
    const yes = await confirm({
      title: t('wl_so_q', 'Sign out?'),
      message: t('wl_so_text', 'You will need your PIN to sign in again.'),
      ok: t('sign_out', 'Sign out'),
      cancel: t('cancel', 'Cancel'),
      destructive: true,
    });
    if (yes) { await session.logout(); router.replace('/sign-in'); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style="light" />
      <View style={[styles.top, { borderBottomColor: c.hairline, paddingHorizontal: wide ? space[6] : space[4] }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="title" style={{ fontSize: wide ? 24 : 20 }}>{t('wl_choose_ring', 'Choose your ring')}</Txt>
          <Txt v="caption" color="inkMuted" numberOfLines={1}>{p.name} · {t(ROLE_KEY[p.role][0], ROLE_KEY[p.role][1])} · {p.tournament.name}</Txt>
        </View>
        <Button label={t('sign_out', 'Sign out')} icon="signout" variant="secondary" onPress={() => { void signOut(); }} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: wide ? space[6] : space[4] }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => { void load(); }} />}>
        {err ? (
          <View style={[styles.err, { backgroundColor: c.alertSoft, borderColor: c.alert }]} accessibilityRole="alert">
            <Icon name="alert" size={18} color={c.alertText} />
            <Txt v="body" color="alertText" style={{ flex: 1 }}>{err}</Txt>
            <Button label={t('wl_retry', 'Try again')} variant="secondary" onPress={() => { void load(); }} />
          </View>
        ) : null}
        {!rings ? <Txt v="body" color="inkMuted">{t('wl_loading_rings', 'Loading rings…')}</Txt> : null}
        {rings && !rings.rings.length ? <Txt v="body" color="inkMuted">{t('wl_no_rings', 'No rings are scheduled for {date}.', { date: rings.date })}</Txt> : null}
        <View style={[styles.grid, { flexDirection: wide ? 'row' : 'column' }]}>
          {rings?.rings.map((g) => {
            const mine = p.ring?.toUpperCase() === g.ring.toUpperCase();
            return (
              <View key={g.ring} style={[styles.ring, { backgroundColor: c.surface, borderColor: mine ? c.gold : c.hairline }, wide && { flexBasis: '31%', flexGrow: 1 }]}>
                <View style={styles.head}>
                  <Txt v="title" style={{ fontSize: 22 }}>{t('ring', 'Ring')} {g.ring}</Txt>
                  <RuleBadge tone={g.operatorTaken ? 'approved' : 'unconfigured'} label={g.operatorTaken ? t('wl_op_in', 'Operator in') : t('wl_op_none', 'No operator')} />
                </View>
                {p.role === 'JUDGE' ? (
                  <View style={styles.seats} accessibilityRole="radiogroup" accessibilityLabel={`${t('ring', 'Ring')} ${g.ring}`}>
                    {g.seats.filter((s) => s.used).map((s) => {
                      const taken = s.taken && !s.mine;
                      const loading = busy === `${g.ring}-${s.seat}`;
                      return (
                        <Pressable key={s.seat} disabled={taken || !!busy} onPress={() => { void ask(g.ring, s.seat); }}
                          accessibilityRole="radio" accessibilityState={{ checked: s.mine, disabled: taken }}
                          accessibilityLabel={`J${s.seat}${taken ? ', taken' : s.mine ? ', your seat' : ', free'}`}
                          style={({ pressed }) => [styles.seat, {
                            backgroundColor: s.mine ? c.gold : taken ? 'transparent' : pressed ? c.surfaceSunken : c.surfaceRaised,
                            borderColor: s.mine ? c.gold : taken ? c.hairline : c.controlBorder,
                            borderStyle: taken ? 'dashed' : 'solid',
                          }]}>
                          <Txt v="scoreMd" color={s.mine ? 'onGold' : taken ? 'inkMuted' : 'ink'} style={{ fontSize: 22 }}>{loading ? '…' : `J${s.seat}`}</Txt>
                          <Txt v="caption" color={s.mine ? 'onGold' : 'inkMuted'} style={{ fontSize: 10 }}>{s.mine ? t('wl_you', 'You') : taken ? t('wl_taken', 'Taken') : t('wl_free', 'Free')}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Button label={busy === `${g.ring}-` ? '…' : p.role === 'OPERATOR' ? t('wl_run_ring', 'Run this ring') : t('wl_open_ring', 'Open this ring')}
                    icon="chevron" variant={mine ? 'primary' : 'secondary'} size="lg" block disabled={!!busy} onPress={() => { void ask(g.ring); }} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: 1, paddingVertical: space[2] },
  body: { paddingVertical: space[5], gap: space[4] },
  err: { flexDirection: 'row', gap: space[2], alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: space[3] },
  grid: { gap: space[4], flexWrap: 'wrap' },
  ring: { borderRadius: radius.lg, borderWidth: 1.5, padding: space[5], gap: space[3], minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  seats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  seat: { flexGrow: 1, flexBasis: 56, minHeight: 64, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
});
