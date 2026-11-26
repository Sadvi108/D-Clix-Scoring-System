// Chief referee pages (All rings, History, Rounds) share this frame: header with page tabs, the
// link status and an account menu (swap sides, language, change ring, sign out). Signed in through
// the API; other roles go to their own screen.
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLinkPill } from '@/device/network';
import { toggleSides, usePkSides } from '@/features/judge/sideLayout';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { session, texts, useSession, useTexts } from '@/live';
import { homeFor } from '@/live/routes';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { confirm } from '@/ui/confirm';
import { Button, Icon, RuleBadge, StatusPill, Txt, type IconName } from '@/ui/primitives';

export type ChiefTab = 'rings' | 'history' | 'rounds';
const TABS: { id: ChiefTab; label: string; icon: IconName; href: '/chief' | '/chief/history' | '/chief/rounds' }[] = [
  { id: 'rings', label: 'All rings', icon: 'menu', href: '/chief' },
  { id: 'history', label: 'History', icon: 'list', href: '/chief/history' },
  { id: 'rounds', label: 'Rounds', icon: 'award', href: '/chief/rounds' },
];

export function ChiefShell({ tab, children }: { tab: ChiefTab; children: ReactNode }) {
  const sess = useSession();
  if (sess.status === 'booting') {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  if (sess.status === 'signedOut' || !sess.profile) return <Redirect href="/sign-in" />;
  if (sess.profile.role !== 'CHIEF') return <Redirect href={homeFor(sess.profile)} />;
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
  const p = useSession().profile;
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
          <Pressable onPress={() => router.replace(p?.ring ? '/referee' : '/rings')} accessibilityRole="button" accessibilityLabel="Back to the ring console" hitSlop={8}
            style={({ pressed }) => [styles.round, { borderColor: c.hairline, backgroundColor: pressed ? c.surfaceRaised : 'transparent' }]}>
            <Icon name="menu" size={20} />
            {wide ? <Txt v="label">Console</Txt> : null}
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
      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: wide ? space[6] : space[4] }]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      {menu ? <AccountMenu onClose={() => setMenu(false)} /> : null}
    </SafeAreaView>
  );
}

function AccountMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { c } = useTheme();
  const p = useSession().profile;
  const tx = useTexts();
  const { swapped } = usePkSides();
  const row = (label: string, right: ReactNode, sub?: string) => (
    <View style={[styles.row, { borderBottomColor: c.hairline }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="label">{label}</Txt>
        {sub ? <Txt v="caption" color="inkMuted">{sub}</Txt> : null}
      </View>
      {right}
    </View>
  );
  async function signOut() {
    const yes = await confirm({ title: 'Sign out?', message: 'This tablet signs out of the chief referee account.', ok: 'Sign out', cancel: 'Cancel' });
    if (!yes) return;
    onClose();
    await session.logout();
    router.replace('/sign-in');
  }
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView style={styles.menuWrap} pointerEvents="box-none">
        <View style={[styles.menu, { backgroundColor: c.surface, borderColor: c.hairline }]} accessibilityViewIsModal>
          <View style={[styles.row, { borderBottomColor: c.hairline }]}>
            <View style={[styles.avatar, { borderColor: c.gold, backgroundColor: c.goldSoft }]}><Icon name="user" size={20} color={c.goldText} /></View>
            <View style={{ flex: 1 }}>
              <Txt v="heading">{p?.name ?? 'Chief referee'}</Txt>
              <Txt v="caption" color="inkMuted">Chief referee · {p?.ring ? `Ring ${p.ring}` : 'no ring open'}</Txt>
            </View>
          </View>
          {row('Swap sides', <Button label={swapped ? 'Hong left' : 'Chung left'} icon="swap" variant="secondary" onPress={toggleSides} />, 'PK layout on this device')}
          {tx.languages.length >= 2 ? row('Language', (
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 230 }}>
              {tx.languages.map((l) => {
                const on = l.code === tx.lang;
                return (
                  <Pressable key={l.code} onPress={() => void texts.setLang(l.code)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={[styles.chip, { borderColor: on ? c.ink : c.controlBorder, backgroundColor: on ? c.ink : 'transparent' }]}>
                    <Txt v="label" color={on ? c.surface : 'ink'} style={{ fontSize: 13 }}>{l.native}</Txt>
                  </Pressable>
                );
              })}
            </View>
          )) : null}
          {row('Ring', <Button label="Change ring" icon="chevron" variant="secondary" onPress={() => { onClose(); router.push('/rings'); }} />, 'Open another ring on this tablet')}
          <Button label="Sign out" icon="signout" variant="danger" block onPress={() => void signOut()} />
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
