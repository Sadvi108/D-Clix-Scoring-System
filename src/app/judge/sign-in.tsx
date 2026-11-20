import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, useScoring } from '@/data';
import { DEMO_QR_CODE } from '@/data/mock/seed';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { PinPad } from '@/ui/officials';
import { Button, Icon, RuleBadge, StatusPill, Txt } from '@/ui/primitives';

export default function JudgeSignIn() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const [seat, setSeat] = useState(3);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (r.ok) router.replace('/judge');
    else { setErr(r.error ?? 'Sign-in failed'); setPin(''); }
  }

  const qr = (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline, flex: wide ? 1 : undefined }]}>
      <Txt v="title">Scan your assignment code</Txt>
      <Txt v="body" color="inkMuted">The chief referee shows a code for each judge seat. Codes work once and expire after 60 seconds.</Txt>
      <View style={[styles.qr, { backgroundColor: c.surfaceSunken, minHeight: wide ? 220 : 140 }]}>
        <Icon name="qr" size={wide ? 72 : 52} color={c.inkMuted} stroke={1.5} />
      </View>
      <Button label="Scan code (demo)" icon="qr" variant="secondary" size="lg" block disabled={busy} onPress={() => go(() => api.signInWithCode(DEMO_QR_CODE))} />
    </View>
  );

  const pinCard = (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline, flex: wide ? 1 : undefined }]}>
      <Txt v="title">Or pick your seat and enter your PIN</Txt>
      <View style={styles.seats} accessibilityRole="radiogroup">
        {s.judges.map((j) => {
          const on = j.judgeNo === seat;
          return (
            <Pressable key={j.judgeNo} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setSeat(j.judgeNo)}
              style={[styles.seat, { backgroundColor: on ? c.gold : c.surfaceRaised, borderColor: on ? c.gold : c.controlBorder }]}>
              <Txt v="scoreMd" color={on ? 'onGold' : 'ink'}>J{j.judgeNo}</Txt>
            </Pressable>
          );
        })}
      </View>
      <PinPad value={pin} error={err} keyWidth={wide ? 96 : 92}
        onDigit={(d) => { setErr(null); setPin((p) => p + d); }} onBack={() => setPin((p) => p.slice(0, -1))} onClear={() => setPin('')} />
      <Txt v="caption" color="inkMuted" style={{ textAlign: 'center' }}>Demo PIN for every seat: 1234</Txt>
      <Button label={busy ? 'Signing in…' : `Sign in as Judge ${seat}`} icon="check" size="lg" block disabled={pin.length < 4 || busy} onPress={() => go(() => api.signInJudge(seat, pin))} />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style="light" />
      <View style={[styles.top, { borderBottomColor: c.hairline }]}>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Back to role menu" style={styles.brand} hitSlop={8}>
          <Txt v="scoreMd" style={{ fontFamily: 'SairaCondensed_800ExtraBold' }}>Poomsae</Txt>
          {wide ? <Txt v="overline" color="inkMuted">Scoring · Judge</Txt> : null}
        </Pressable>
        <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
          <RuleBadge tone="draft" label="UAT" />
          <StatusPill status="online" detail={wide ? s.ring.name : undefined} compact />
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { flexDirection: wide ? 'row' : 'column' }]} keyboardShouldPersistTaps="handled">
        {qr}
        {pinCard}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], borderBottomWidth: 1 },
  brand: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  body: { padding: space[4], gap: space[4], alignItems: 'stretch' },
  card: { borderRadius: radius.md, borderWidth: 1, padding: space[5], gap: space[4] },
  qr: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  seats: { flexDirection: 'row', gap: 6 },
  seat: { flex: 1, height: 48, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
