// Start · Sign in. Same look as the D-Clix web app: logo, six PIN boxes, a 3×4 keypad with
// backspace, 0 and Sign in on the last row, and a language button. One 6-digit PIN for every
// official; the PIN decides the role (judge, ring operator or chief referee), then the ring.
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeypadCapture } from '@/device/keypad';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { session, texts, useSession, useTexts } from '@/live';
import { homeFor } from '@/live/routes';
import { fonts, radius, space } from '@/theme/tokens';
import { confirm } from '@/ui/confirm';
import { Icon, Txt } from '@/ui/primitives';

const LENGTH = 6;

/** The web sign-in palette (navy), kept local so this screen matches it exactly. */
const N = {
  ground: '#0b1220',
  key: '#17223d',
  keyPressed: '#22305a',
  border: '#24304d',
  focus: '#2f6bff',
  ink: '#eef2fb',
  muted: '#8e9ab5',
  gold: '#f4c247',
  onGold: '#1b1405',
  alert: '#ff8a80',
  logoRing: '#f08a1c',
};

export default function SignIn() {
  useFreeOrientation();
  const router = useRouter();
  const sess = useSession();
  const tx = useTexts();
  const { width, height } = useWindowDimensions();
  const compact = height < 640; // phone in landscape
  const roomy = height >= 900;
  // Keypad width: 600 on a tablet like the web, full width (minus margins) on a phone.
  const padW = Math.min(600, width - space[5] * 2);
  const gap = padW < 420 ? 10 : 16;
  const keyW = (padW - gap * 2) / 3;
  // Key height follows the screen height so all four rows fit without scrolling (tablet landscape included).
  const keyH = Math.round(Math.max(48, Math.min(86, keyW * 0.46, (height - 500) / 4 - gap * 0.75)));
  const slot = Math.min(64, (padW * 0.76 - 5 * 12) / 6);
  const [pin, setPin] = useState('');
  // A message from the server when this tablet was signed out (expired, or moved to another device).
  const [err, setErr] = useState<string | null>(sess.message || null);
  const [busy, setBusy] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const t = texts.t;

  async function signIn(p = pin, confirmReplace = false) {
    if (p.length < LENGTH || busy) return;
    setBusy(true);
    const r = await session.login(p, confirmReplace);
    setBusy(false);
    if (r.kind === 'takeover') {
      const yes = await confirm({
        title: t('wl_already_title', 'Already signed in'),
        message: t('wl_already_text', 'This account is signed in on {device}. Sign in here and sign that device out?', { device: r.deviceLabel }),
        ok: t('wl_takeover', 'Sign in here'),
        cancel: t('cancel', 'Cancel'),
      });
      if (yes) void signIn(p, true); else setPin('');
      return;
    }
    if (r.kind === 'error') {
      if (r.code === 'BUSY') return;
      setErr(r.message);
      setPin('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setPin('');
    router.replace(homeFor(r.profile));
  }

  const digit = (d: string) => {
    setErr(null);
    setPin((p) => (p.length >= LENGTH ? p : p + d));
  };
  const back = () => { setErr(null); setPin((p) => p.slice(0, -1)); };

  const key = (label: string, onPress: () => void, opts: { icon?: 'backspace'; primary?: boolean; disabled?: boolean; a11y?: string } = {}) => (
    <Pressable key={label} onPress={() => { Haptics.selectionAsync(); onPress(); }} disabled={opts.disabled}
      accessibilityRole="button" accessibilityLabel={opts.a11y ?? label} accessibilityState={{ disabled: !!opts.disabled }}
      style={({ pressed }) => [styles.key, {
        width: keyW, height: keyH,
        backgroundColor: opts.primary ? N.gold : pressed ? N.keyPressed : N.key,
        borderColor: opts.primary ? N.gold : N.border,
        opacity: opts.disabled ? 0.55 : pressed && opts.primary ? 0.85 : 1,
      }]}>
      {opts.icon ? <Icon name={opts.icon} size={26} color={N.ink} />
        : <Txt style={{ fontFamily: opts.primary ? fonts.sansBold : fonts.display, fontSize: opts.primary ? 20 : 30, lineHeight: opts.primary ? 26 : 34, color: opts.primary ? N.onGold : N.ink }}>{label}</Txt>}
    </Pressable>
  );

  if (sess.status === 'signedIn' && sess.profile) return <Redirect href={homeFor(sess.profile)} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: N.ground }}>
      <StatusBar style="light" />
      {/* A USB or Bluetooth keypad can type the PIN too. */}
      <KeypadCapture onKey={(k) => {
        if (/^\d$/.test(k)) digit(k);
        else if (k === 'Backspace') back();
        else if (k === 'Enter') signIn();
      }} />
      <ScrollView contentContainerStyle={[styles.body, { paddingVertical: compact ? space[3] : roomy ? space[6] : space[4] }, compact && { paddingHorizontal: 84 }]} keyboardShouldPersistTaps="handled">
        <View style={{ width: padW, gap: compact ? space[3] : roomy ? space[5] : space[4], alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            {/* Official D-Clix logo (round, with its own orange ring). */}
            <View style={[styles.logo, !roomy && { width: compact ? 80 : 104, height: compact ? 80 : 104, borderRadius: compact ? 40 : 52 }]}>
              <Image source={require('../../assets/dclix-logo.png')} style={styles.logoImg} resizeMode="contain" accessibilityLabel="D-Clix, sports technology platform" />
            </View>
            <Txt style={{ fontFamily: fonts.sansBold, fontSize: compact ? 24 : 30, lineHeight: compact ? 30 : 38, color: N.ink, textAlign: 'center' }}>{t('app_title', 'D-Clix Scoring System')}</Txt>
            <Txt style={{ fontSize: 17, color: N.muted, textAlign: 'center' }}>{t('signin_hint', 'Enter your 6-digit PIN')}</Txt>
          </View>

          {/* Six PIN boxes; the next empty box is highlighted. Digits are hidden. */}
          <View style={{ flexDirection: 'row', gap: 12 }} accessibilityLabel={`${pin.length} of ${LENGTH} digits entered`} accessibilityLiveRegion="polite">
            {Array.from({ length: LENGTH }).map((_, i) => {
              const focus = i === pin.length && !err;
              return (
                <View key={i} style={[styles.slot, { width: slot, height: Math.round(slot * 1.12), backgroundColor: N.key, borderColor: err ? N.alert : focus ? N.focus : N.border, borderWidth: focus || err ? 2 : 1 }]}>
                  {i < pin.length ? <View style={[styles.dot, { backgroundColor: N.ink }]} /> : null}
                </View>
              );
            })}
          </View>
          <Txt accessibilityRole="alert" style={{ minHeight: 20, color: N.alert, fontSize: 15, textAlign: 'center', marginTop: -space[2] }}>{err ?? ''}</Txt>

          <View style={[styles.grid, { gap }]}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => digit(d)))}
            {key('back', back, { icon: 'backspace', a11y: 'Delete last digit', disabled: pin.length === 0 })}
            {key('0', () => digit('0'))}
            {key(busy ? t('wl_signing_in', 'Signing in…') : t('signin_btn', 'Sign in'), () => signIn(), { primary: true, disabled: pin.length < LENGTH || busy })}
          </View>
        </View>
      </ScrollView>

      {/* Corners: role menu (demo) on the left, language on the right. */}
      <SafeAreaView style={styles.corners} pointerEvents="box-none">
        <Pressable onPress={() => router.push('/menu')} accessibilityRole="button" accessibilityLabel="Role menu" hitSlop={6}
          style={({ pressed }) => [styles.square, { backgroundColor: pressed ? N.keyPressed : N.key, borderColor: N.border }]}>
          <Icon name="menu" size={22} color={N.ink} />
        </Pressable>
        {/* Shown only when the server offers two or more languages. */}
        {tx.languages.length >= 2 ? (
          <Pressable onPress={() => setLangOpen(true)} accessibilityRole="button" accessibilityLabel={t('wl_lang', 'Language')} hitSlop={6}
            style={({ pressed }) => [styles.square, { backgroundColor: pressed ? N.keyPressed : N.key, borderColor: N.border }]}>
            <Icon name="globe" size={24} color={N.ink} />
          </Pressable>
        ) : <View />}
      </SafeAreaView>
      {langOpen ? (
        <Modal visible transparent animationType="none" onRequestClose={() => setLangOpen(false)} supportedOrientations={['portrait', 'landscape']}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(3,6,14,0.7)' }]} onPress={() => setLangOpen(false)} accessibilityLabel="Close" />
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <View style={[styles.sheet, { backgroundColor: N.key, borderColor: N.border }]}>
              <Txt style={{ fontFamily: fonts.sansBold, fontSize: 20, color: N.ink }}>{t('wl_lang', 'Language')}</Txt>
              {tx.languages.map((l) => {
                const on = tx.lang === l.code;
                return (
                  <Pressable key={l.code} onPress={() => { void texts.setLang(l.code); setLangOpen(false); }}
                    accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={[styles.langRow, { borderColor: on ? N.focus : N.border }]}>
                    <Txt v="label" style={{ color: N.ink, flex: 1 }}>{l.native || l.name}</Txt>
                    {on ? <Icon name="check" size={18} color={N.focus} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[5] },
  corners: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[4], paddingTop: space[3] },
  square: { width: 56, height: 56, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center',
    shadowColor: N.logoRing, shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  logoImg: { width: '100%', height: '100%' },
  slot: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  key: { borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sheetWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: space[4] },
  sheet: { width: '100%', maxWidth: 380, borderRadius: radius.lg, borderWidth: 1, padding: space[5], gap: space[3] },
  langRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space[4], borderRadius: radius.md, borderWidth: 1.5 },
});
