// Device tools reachable from sign-in: connection, live status, venue display and the setup screens
// that TMS manages for now. Work screens open after signing in with a PIN.
import { StatusBar } from 'expo-status-bar';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { useLinkPill } from '@/device/network';
import { useSession } from '@/live';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, RuleBadge, StatusPill, Txt, type IconName } from '@/ui/primitives';

const TOOLS: { href: Href; icon: IconName; title: string; who: string; tag?: string }[] = [
  { href: '/sign-in', icon: 'user', title: 'Sign in', who: 'Judge, ring operator or chief referee: 6-digit PIN' },
  { href: '/scoreboard', icon: 'tv', title: 'Venue display', who: 'Scoreboard from a TV link key' },
  { href: '/connection', icon: 'cable', title: 'Device connection', who: 'Wired (USB-C) or Wi-Fi link, server address, USB keypad' },
  { href: '/ring-status', icon: 'list', title: 'Live status', who: 'Who is signed in, the ring state and the send queue' },
  { href: '/admin', icon: 'sliders', title: 'Competition setup', who: 'Rule sets, rounds, panel and devices', tag: 'Managed in TMS' },
];

export default function Menu() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const link = useLinkPill();
  const p = useSession().profile;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.body, { padding: wide ? space[6] : space[4] }]}>
        <View style={styles.head}>
          <Button label="‹  Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={{ flex: 1 }}>
            <Txt v="title" style={{ fontSize: 26 }}>D-Clix Scoring System</Txt>
            <Txt v="caption" color="inkMuted">{p ? `Signed in: ${p.name} · ${p.role}${p.ring ? ` · Ring ${p.ring}` : ''}` : 'Not signed in'}</Txt>
          </View>
          <RuleBadge tone="draft" label="UAT" />
          <StatusPill status={link} compact={!wide} />
        </View>
        {TOOLS.map((t) => (
          <Pressable key={t.title} accessibilityRole="button" accessibilityLabel={t.title} onPress={() => router.push(t.href)}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfaceRaised : c.surface, borderColor: c.hairline }]}>
            <Icon name={t.icon} size={22} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="label" style={{ fontSize: 16 }}>{t.title}</Txt>
              <Txt v="caption" color="inkMuted">{t.who}</Txt>
            </View>
            {t.tag ? <RuleBadge tone="draft" label={t.tag} /> : null}
            <Icon name="chevron" size={18} color={c.inkMuted} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { gap: space[3], width: '100%', maxWidth: 820, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap', marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1 },
});
