// Start · Choose your ring.
//   Judge: every ring with its seats J1–J5; tap a free seat to sit there.
//   Ring operator / chief referee: every ring with "Open this ring".
import { StatusBar } from 'expo-status-bar';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AccountRole, RingInfo } from '@/core/types';
import { api, useScoring } from '@/data';
import { ROLE_HOME, ROLE_LABEL, ROLE_PARAM, roleFromParam } from '@/features/session/session';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, RuleBadge, Txt } from '@/ui/primitives';

export default function Rings() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { as } = useLocalSearchParams<{ as?: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const role: AccountRole | null = roleFromParam(as) ?? s.accounts.at(-1)?.role ?? null;
  const acc = role ? s.accounts.find((a) => a.role === role) : null;
  if (!role || !acc) return <Redirect href={{ pathname: '/sign-in', params: role ? { next: ROLE_PARAM[role] } : {} }} />;

  async function seat(ring: RingInfo, judgeNo: number) {
    setBusy(`${ring.id}-${judgeNo}`); setErr(null);
    const r = await api.takeSeat(ring.id, judgeNo);
    setBusy(null);
    if (r.ok) router.replace('/judge'); else setErr(r.error);
  }
  async function open(ring: RingInfo) {
    setBusy(ring.id); setErr(null);
    const r = await api.chooseRing(ring.id);
    setBusy(null);
    if (r.ok) router.replace(ROLE_HOME[role!]); else setErr(r.error);
  }

  const live = (ring: RingInfo) => {
    // Demo: the sample games run on whichever ring is open on this device.
    const cur = ring.id === s.ring.id ? s.current : null;
    if (!cur) return null;
    return `Game ${cur.matchNo} · ${cur.hong ? `${cur.chung.name} vs ${cur.hong.name}` : cur.chung.name}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style="light" />
      <View style={[styles.top, { borderBottomColor: c.hairline, paddingHorizontal: wide ? space[6] : space[4] }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="title" style={{ fontSize: wide ? 24 : 20 }}>Choose your ring</Txt>
          <Txt v="caption" color="inkMuted" numberOfLines={1}>{acc.name} · {ROLE_LABEL[role]}</Txt>
        </View>
        <Button label="Sign out" icon="signout" variant="secondary" onPress={() => { api.signOut(role); router.replace('/sign-in'); }} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: wide ? space[6] : space[4] }]}>
        {err ? (
          <View style={[styles.err, { backgroundColor: c.alertSoft, borderColor: c.alert }]} accessibilityRole="alert">
            <Icon name="alert" size={18} color={c.alertText} />
            <Txt v="body" color="alertText" style={{ flex: 1 }}>{err}</Txt>
          </View>
        ) : null}
        <View style={[styles.grid, { flexDirection: wide ? 'row' : 'column' }]}>
          {s.rings.map((ring) => {
            const mineHere = role === 'JUDGE' && s.me && s.ring.id === ring.id;
            const now = live(ring);
            return (
              <View key={ring.id} style={[styles.ring, { backgroundColor: c.surface, borderColor: mineHere || (role !== 'JUDGE' && s.ring.id === ring.id) ? c.gold : c.hairline }, wide && { flexBasis: '31%', flexGrow: 1 }]}>
                <View style={styles.head}>
                  <Txt v="title" style={{ fontSize: 22 }}>{ring.name}</Txt>
                  <RuleBadge tone={ring.operatorIn ? 'approved' : 'unconfigured'} label={ring.operatorIn ? 'Operator in' : 'No operator'} />
                </View>
                <Txt v="caption" color="inkMuted" numberOfLines={1}>{now ?? 'No game on the mat'}</Txt>

                {role === 'JUDGE' ? (
                  <>
                    <View style={styles.seats} accessibilityRole="radiogroup" accessibilityLabel={`${ring.name} seats`}>
                      {ring.seats.map((st) => {
                        const mine = st.takenBy === acc.name;
                        const taken = !!st.takenBy && !mine;
                        const loading = busy === `${ring.id}-${st.judgeNo}`;
                        return (
                          <Pressable key={st.judgeNo} disabled={taken || !!busy} onPress={() => seat(ring, st.judgeNo)}
                            accessibilityRole="radio" accessibilityState={{ checked: mine, disabled: taken }}
                            accessibilityLabel={`Seat J${st.judgeNo}${taken ? `, taken by ${st.takenBy}` : mine ? ', your seat' : ', free'}`}
                            style={({ pressed }) => [styles.seat, {
                              backgroundColor: mine ? c.gold : taken ? 'transparent' : pressed ? c.surfaceSunken : c.surfaceRaised,
                              borderColor: mine ? c.gold : taken ? c.hairline : c.controlBorder,
                              borderStyle: taken ? 'dashed' : 'solid',
                            }]}>
                            <Txt v="scoreMd" color={mine ? 'onGold' : taken ? 'inkMuted' : 'ink'} style={{ fontSize: 22 }}>{loading ? '…' : `J${st.judgeNo}`}</Txt>
                            <Txt v="caption" color={mine ? 'onGold' : 'inkMuted'} numberOfLines={1} style={{ fontSize: 10 }}>
                              {mine ? 'You' : taken ? st.takenBy!.split(' ')[0] : 'Free'}
                            </Txt>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Txt v="caption" color="inkMuted">Tap a free seat. Your scores go to {ring.name} as that judge number.</Txt>
                  </>
                ) : (
                  <Button label={busy === ring.id ? 'Opening…' : s.ring.id === ring.id ? 'Open this ring · current' : 'Open this ring'} icon="chevron"
                    variant={s.ring.id === ring.id ? 'primary' : 'secondary'} size="lg" block disabled={!!busy} onPress={() => open(ring)} />
                )}
              </View>
            );
          })}
        </View>
        <Txt v="caption" color="inkMuted" style={{ textAlign: 'center' }}>Demo: the sample games run on whichever ring you open.</Txt>
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
  seats: { flexDirection: 'row', gap: 8 },
  seat: { flex: 1, minHeight: 64, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
});
