import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, useScoring } from '@/data';
import { useLinkPill } from '@/device/network';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, RuleBadge, StatusPill, Txt, type IconName } from '@/ui/primitives';

const ROLES: { href: Href; icon: IconName; title: string; who: string; device: string }[] = [
  { href: '/judge', icon: 'pencil', title: 'Judge', who: 'Score deductions and presentation, send to the server', device: 'Phone or tablet' },
  { href: '/operator', icon: 'flag', title: 'Ring operator', who: 'Call athletes, open scoring, run the clock', device: 'Tablet' },
  { href: '/referee', icon: 'users', title: 'Chief referee', who: 'Watch submissions, review the result, release it', device: 'Tablet' },
  { href: '/scoreboard', icon: 'tv', title: 'Scoreboard', who: 'Released results for the venue screen', device: 'Tablet or TV' },
  { href: '/results', icon: 'award', title: 'Results', who: 'Standings, ties, qualification, medals and the audit log', device: 'Tablet' },
  { href: '/admin', icon: 'sliders', title: 'Competition setup', who: 'Rule sets, categories and rounds, judge panel and devices', device: 'Tablet' },
  { href: '/connection', icon: 'cable', title: 'Device connection', who: 'Wired (USB-C) or Wi-Fi link, server address, USB keypad', device: 'Every device' },
];

const STEPS = [
  'Competition setup: rule set, rounds of each category, the 5-judge panel and paired devices',
  'Sign in with a 6-digit PIN (demo: judge 111111, operator 222222, chief 333333). Judges then pick a ring and a free seat; operator and chief pick a ring',
  'Ring operator: call match 101, confirm on mat, open scoring, start the form. Pause locks every judge; Stop game ends it early (injury)',
  'Judge: score Chung (blue) and Hong (red), send. The ⇄ button swaps sides if Hong sits on your left',
  'Chief referee: review the panel, request a correction if needed, release',
  'Scoreboard: show the released result',
  'Cut-off: call P-12 (Recognized, one athlete in blue) or F-1 (Freestyle pair: technical + presentation items, no deduction keys)',
  'Results: the bout moves Male Under 30 on; resolve the Male Under 17 tie, confirm qualification, send the next round to the ring',
];

export default function Home() {
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const link = useLinkPill();

  useFreeOrientation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.wrap, { paddingHorizontal: wide ? space[7] : space[4] }]}>
        <View style={styles.head}>
          <View style={{ gap: space[2], flexShrink: 1 }}>
            <View style={styles.brand}>
              <View style={styles.bars} accessibilityElementsHidden>
                {Array.from({ length: 16 }).map((_, i) => (
                  <View key={i} style={{ width: 5, height: 34 - i * 1.6, borderRadius: 3, backgroundColor: i < 8 ? c.chung : c.hong }} />
                ))}
              </View>
              <Txt v="scoreHero" adjustsFontSizeToFit numberOfLines={1} style={{ flexShrink: 1, fontSize: wide ? 56 : 40, lineHeight: wide ? 56 : 44 }}>D-Clix Scoring System</Txt>
            </View>
            <Txt v="body" color="inkMuted">Electronic scoring for Taekwondo Poomsae · {s.ring.name}</Txt>
          </View>
          <View style={{ gap: space[2], alignItems: wide ? 'flex-end' : 'flex-start' }}>
            <RuleBadge tone="draft" label="Prototype · sample data" />
            <StatusPill status="online" label={s.mode === 'mock' ? 'Demo server (on device)' : 'Connected'} />
            <Pressable onPress={() => router.push('/connection')} accessibilityRole="button" accessibilityLabel="Device connection"><StatusPill status={link} /></Pressable>
          </View>
        </View>

        <Txt v="overline" color="inkMuted">Choose a role</Txt>
        <View style={[styles.grid, { flexDirection: wide ? 'row' : 'column' }]}>
          {ROLES.map((r) => (
            <Pressable key={r.title} accessibilityRole="button" onPress={() => router.push(r.href)}
              style={({ pressed }) => [styles.tile, { backgroundColor: c.surface, borderColor: pressed ? c.gold : c.hairline, flexBasis: wide ? '30%' : 'auto' }, wide && { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={[styles.tileIcon, { backgroundColor: c.surfaceRaised }]}><Icon name={r.icon} size={26} color={c.goldText} /></View>
              <View style={{ flex: wide ? undefined : 1, gap: 4 }}>
                <Txt v="title">{r.title}</Txt>
                <Txt v="caption" color="inkMuted">{r.who}</Txt>
                <Txt v="overline" color="inkMuted" style={{ marginTop: 4 }}>{r.device}</Txt>
              </View>
              {!wide ? <Icon name="chevron" size={20} color={c.inkMuted} /> : null}
            </Pressable>
          ))}
        </View>

        <View style={[styles.demo, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Txt v="overline" color="goldText">Committee demo flow</Txt>
          {STEPS.map((t, i) => (
            <View key={t} style={{ flexDirection: 'row', gap: space[3], alignItems: 'flex-start' }}>
              <Txt v="scoreMd" color="inkMuted" style={{ width: 20 }}>{i + 1}</Txt>
              <Txt v="body" style={{ flex: 1 }}>{t}</Txt>
            </View>
          ))}
          <Txt v="caption" color="inkMuted">Prototype runs on one device: the other judges are simulated. Use the menu button at the top-left of each screen to switch roles.</Txt>
          <Button label="Reset demo data" icon="refresh" variant="secondary" onPress={() => api.resetDemo()} style={{ alignSelf: 'flex-start' }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space[6], gap: space[4] },
  head: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: space[4], marginBottom: space[3] },
  brand: { flexDirection: 'row', alignItems: 'flex-end', gap: space[3] },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 34, marginBottom: 6 },
  grid: { gap: space[3], flexWrap: 'wrap' },
  tile: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1.5, minHeight: 96 },
  tileIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  demo: { borderRadius: radius.md, borderWidth: 1, padding: space[4], gap: space[3], marginTop: space[3] },
});
