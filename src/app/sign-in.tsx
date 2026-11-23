// Start · Sign in. One 6-digit PIN for every official; the PIN decides the role (judge, ring
// operator or chief referee). After signing in the official picks a ring (and a seat, for judges).
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, useScoring } from '@/data';
import { KeypadCapture } from '@/device/keypad';
import { ROLE_LABEL, ROLE_PARAM, roleFromParam } from '@/features/session/session';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { PinPad } from '@/ui/officials';
import { Button, Icon, RuleBadge, Txt } from '@/ui/primitives';

const LENGTH = 6;

export default function SignIn() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const wanted = roleFromParam(next);
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const short = height < 700;
  const [pin, setPin] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(p = pin) {
    if (p.length < LENGTH || busy) return;
    setBusy(true);
    const before = new Set(s.accounts.map((a) => a.role));
    const r = await api.signInPin(p);
    setBusy(false);
    if (!r.ok) { setErr(r.error); setPin(''); return; }
    // The role the PIN belongs to: the one that is new (or refreshed) on this device.
    const acc = api.getSnapshot().accounts.find((a) => !before.has(a.role)) ?? api.getSnapshot().accounts.at(-1);
    setPin('');
    if (acc) router.replace({ pathname: '/rings', params: { as: ROLE_PARAM[acc.role] } });
  }

  const digit = (d: string) => {
    setErr(null);
    setPin((p) => {
      const n = (p + d).slice(0, LENGTH);
      return n;
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style="light" />
      {/* A USB or Bluetooth keypad can type the PIN too. */}
      <KeypadCapture onKey={(k) => {
        if (/^\d$/.test(k)) digit(k);
        else if (k === 'Backspace') setPin((p) => p.slice(0, -1));
        else if (k === 'Enter') signIn();
      }} />
      <View style={[styles.top, { borderBottomColor: c.hairline }]}>
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Back to role menu" hitSlop={8}
          style={({ pressed }) => [styles.back, { borderColor: c.hairline, backgroundColor: pressed ? c.surfaceRaised : 'transparent' }]}>
          <Icon name="menu" size={20} />
          {wide ? <Txt v="label">Menu</Txt> : null}
        </Pressable>
        <RuleBadge tone="draft" label="UAT" />
      </View>
      <ScrollView contentContainerStyle={[styles.body, short && { paddingVertical: space[3] }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline, width: wide ? 440 : '100%' }]}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View style={styles.bars} accessibilityElementsHidden>
              {Array.from({ length: 12 }).map((_, i) => (
                <View key={i} style={{ width: 4, height: 22 - i * 1.3, borderRadius: 2, backgroundColor: i < 6 ? c.chung : c.hong }} />
              ))}
            </View>
            <Txt v="title" style={{ fontSize: 24 }}>D-Clix Scoring</Txt>
            <Txt v="body" color="inkMuted">{wanted ? `Sign in as ${ROLE_LABEL[wanted].toLowerCase()}` : 'Enter your 6-digit PIN'}</Txt>
          </View>

          <PinPad value={pin} length={LENGTH} error={err} keyWidth={wide ? 104 : 88}
            onDigit={digit} onBack={() => setPin((p) => p.slice(0, -1))} onClear={() => { setPin(''); setErr(null); }} />

          <Button label={busy ? 'Signing in…' : 'Sign in'} icon="check" size="lg" block disabled={pin.length < LENGTH || busy} onPress={() => signIn()} />

          <View style={[styles.demo, { backgroundColor: c.surfaceSunken }]}>
            <Txt v="overline" color="inkMuted">Demo PINs</Txt>
            <Txt v="caption" color="inkMuted">Judge 111111 · Ring operator 222222 · Chief referee 333333</Txt>
          </View>
        </View>

        {s.accounts.length ? (
          <View style={[styles.signed, { width: wide ? 440 : '100%' }]}>
            <Txt v="overline" color="inkMuted">Signed in on this device</Txt>
            {s.accounts.map((a) => (
              <View key={a.role} style={[styles.acc, { backgroundColor: c.surface, borderColor: c.hairline }]}>
                <Icon name="user" size={18} color={c.goldText} />
                <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={() => router.replace({ pathname: '/rings', params: { as: ROLE_PARAM[a.role] } })}>
                  <Txt v="label">{a.name}</Txt>
                  <Txt v="caption" color="inkMuted">{ROLE_LABEL[a.role]}</Txt>
                </Pressable>
                <Button label="Sign out" icon="signout" variant="ghost" onPress={() => api.signOut(a.role)} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], borderBottomWidth: 1 },
  back: { minWidth: 44, height: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 6, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: space[4], gap: space[4] },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space[5], gap: space[4], maxWidth: 480 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 22 },
  demo: { borderRadius: radius.sm, padding: space[3], gap: 2, alignItems: 'center' },
  signed: { gap: space[2], maxWidth: 480 },
  acc: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderRadius: radius.md, borderWidth: 1, paddingLeft: space[3], paddingVertical: 4 },
});
