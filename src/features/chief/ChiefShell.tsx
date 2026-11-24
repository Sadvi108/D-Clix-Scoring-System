// Chief referee pages (All rings, History, Rounds) share this frame: header with page tabs, the
// device's link status and an account menu (swap sides, language, venue display, sign out).
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, useScoring } from '@/data';
import { useLinkPill } from '@/device/network';
import { toggleSides, usePkSides } from '@/features/judge/sideLayout';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, RuleBadge, StatusPill, Txt, type IconName } from '@/ui/primitives';

export type ChiefTab = 'rings' | 'history' | 'rounds';
const TABS: { id: ChiefTab; label: string; icon: IconName; href: '/chief' | '/chief/history' | '/chief/rounds' }[] = [
  { id: 'rings', label: 'All rings', icon: 'menu', href: '/chief' },
  { id: 'history', label: 'History', icon: 'list', href: '/chief/history' },
  { id: 'rounds', label: 'Rounds', icon: 'award', href: '/chief/rounds' },
];

export function ChiefShell({ tab, children }: { tab: ChiefTab; children: ReactNode }) {
  const s = useScoring();
  if (!s.accounts.some((a) => a.role === 'CHIEF')) return <Redirect href={{ pathname: '/sign-in', params: { next: 'chief' } }} />;
  return (
    <ThemeProvider name="daylight">
      <StatusBar style="dark" />
      <Frame tab={tab}>{children}</Frame>
    </ThemeProvider>
  );
}

function Frame({ tab, children }: { tab: ChiefTab; children: ReactNode }) {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const link = useLinkPill();
  const [menu, setMenu] = useState(false);
  const nav = (
    <View style={[styles.nav, !wide && { paddingHorizontal: space[4], paddingBottom: space[2] }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.id === tab;
        return (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.replace(t.href)}
            style={({ pressed }) => [styles.tab, { backgroundColor: on ? c.ink : pressed ? c.surfaceRaised : c.surface, borderColor: on ? c.ink : c.controlBorder }, !wide && { flex: 1 }]}>
            <Icon name={t.icon} size={16} color={on ? c.surface : c.ink} />
            <Txt v="label" color={on ? c.surface : 'ink'}>{t.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right']}>
      <View style={[styles.head, { backgroundColor: c.surface, borderBottomColor: c.hairline }]}>
        <View style={styles.bar}>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Back to role menu" hitSlop={8}
            style={({ pressed }) => [styles.round, { borderColor: c.hairline, backgroundColor: pressed ? c.surfaceRaised : 'transparent' }]}>
            <Icon name="menu" size={20} />
            {wide ? <Txt v="label">Menu</Txt> : null}
          </Pressable>
          <Txt v="title" style={{ fontSize: wide ? 22 : 18 }}>Chief referee</Txt>
          {wide ? nav : <View style={{ flex: 1 }} />}
          {wide ? <RuleBadge tone="draft" label="UAT" /> : null}
          <StatusPill status={link} compact={!wide} />
          <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Account and settings" hitSlop={6}
            style={({ pressed }) => [styles.avatar, { borderColor: c.controlBorder, backgroundColor: pressed ? c.surfaceRaised : c.surface }]}>
            <Icon name="user" size={20} color={c.ink} />
          </Pressable>
        </View>
        {!wide ? nav : null}
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: wide ? space[6] : space[4] }]}>{children}</ScrollView>
      {menu ? <AccountMenu onClose={() => setMenu(false)} /> : null}
    </SafeAreaView>
  );
}

const LANGUAGES = [
  { id: 'en', label: 'English', ready: true },
  { id: 'ko', label: '한국어', ready: false },
  { id: 'ms', label: 'Bahasa Melayu', ready: false },
];

function AccountMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { swapped } = usePkSides();
  const acc = s.accounts.find((a) => a.role === 'CHIEF');
  const [lang, setLang] = useState('en');
  const row = (label: string, right: ReactNode, sub?: string) => (
    <View style={[styles.row, { borderBottomColor: c.hairline }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="label">{label}</Txt>
        {sub ? <Txt v="caption" color="inkMuted">{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView style={styles.menuWrap} pointerEvents="box-none">
        <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.hairline }]} accessibilityViewIsModal>
          <View style={[styles.row, { borderBottomColor: c.hairline }]}>
            <View style={[styles.avatar, { borderColor: c.gold, backgroundColor: c.goldSoft }]}><Icon name="user" size={20} color={c.goldText} /></View>
            <View style={{ flex: 1 }}>
              <Txt v="heading">{acc?.name ?? 'Chief referee'}</Txt>
              <Txt v="caption" color="inkMuted">Chief referee · all rings · this device: {s.ring.name}</Txt>
            </View>
          </View>
          {row('Swap sides', <Button label={swapped ? 'Hong left' : 'Chung left'} icon="swap" variant="secondary" onPress={toggleSides} />, 'PK layout on this device')}
          {row('Language', (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 230 }}>
              {LANGUAGES.map((l) => (
                <Pressable key={l.id} disabled={!l.ready} onPress={() => setLang(l.id)} accessibilityRole="radio" accessibilityState={{ checked: lang === l.id, disabled: !l.ready }}
                  style={[styles.chip, { borderColor: lang === l.id ? c.ink : c.controlBorder, backgroundColor: lang === l.id ? c.ink : 'transparent', opacity: l.ready ? 1 : 0.45 }]}>
                  <Txt v="label" color={lang === l.id ? c.surface : 'ink'} style={{ fontSize: 13 }}>{l.label}</Txt>
                </Pressable>
              ))}
            </View>
          ), 'More languages after the translations are approved')}
          {row('Venue display', <Button label="Open TV" icon="tv" variant="secondary" onPress={() => { onClose(); router.push('/scoreboard'); }} />, 'Scoreboard for the venue screen')}
          <Button label="Sign out" icon="signout" variant="danger" block onPress={() => { api.signOut('CHIEF'); onClose(); router.replace('/sign-in'); }} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { borderBottomWidth: 1 },
  bar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4] },
  nav: { flexDirection: 'row', gap: 8, flex: 1 },
  tab: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  round: { minWidth: 44, height: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 6, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  body: { paddingVertical: space[5], gap: space[4], width: '100%', maxWidth: 1180, alignSelf: 'center' },
  menuWrap: { position: 'absolute', top: 0, right: 0, left: 0, bottom: 0, alignItems: 'flex-end', padding: space[3] },
  menu: { width: '100%', maxWidth: 420, marginTop: 56, borderRadius: radius.lg, borderWidth: 1, padding: space[4], gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, borderBottomWidth: 1, paddingBottom: space[2] },
  chip: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
