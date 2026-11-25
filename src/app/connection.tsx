// Device connection: wired (USB-C Ethernet) or Wi-Fi link, scoring server address, USB keypad.
import { getIpAddressAsync } from 'expo-network';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KEYPAD_MAP, KeypadCapture, keyToAction } from '@/device/keypad';
import { useLink, useLinkPill } from '@/device/network';
import { normaliseServerUrl, updateDeviceSettings, useDeviceSettings } from '@/device/settings';
import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { api, APP_VERSION, PLATFORM } from '@/live';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { KV, Notice } from '@/ui/console';
import { MatchBar } from '@/ui/match';
import { Button, Icon, Panel, StatusPill, Txt } from '@/ui/primitives';

type Test = { state: 'idle' | 'testing' | 'ok' | 'fail'; text?: string };

export default function Connection() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const link = useLink();
  const pill = useLinkPill();
  const settings = useDeviceSettings();
  const [ip, setIp] = useState<string | null>(null);
  const [url, setUrl] = useState(settings.serverUrl);
  const [editing, setEditing] = useState(false);
  const [test, setTest] = useState<Test>({ state: 'idle' });
  const [lastKey, setLastKey] = useState<{ key: string; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    getIpAddressAsync().then((a) => live && setIp(a && a !== '0.0.0.0' ? a : null)).catch(() => live && setIp(null));
    return () => { live = false; };
  }, [link.kind, link.connected]);

  function save() {
    const u = normaliseServerUrl(url);
    setUrl(u);
    updateDeviceSettings({ serverUrl: u });
    return u;
  }

  async function runTest() {
    const u = save();
    if (!u) { setTest({ state: 'fail', text: 'Enter the scoring server address first, for example https://host/Competitionuat/api/v1.' }); return; }
    setTest({ state: 'testing' });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    try {
      const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), 4000); });
      await Promise.race([api.meta(PLATFORM, APP_VERSION), timeout]); // resolves only for an {ok:true} envelope
      setTest({ state: 'ok', text: `Server answered in ${Date.now() - started} ms over ${link.kind === 'wired' ? 'the cable' : link.label}.` });
    } catch {
      setTest({ state: 'fail', text: `No answer from ${u} within 4 s. Check the cable or Wi-Fi, that this tablet and the server are on the same network, and that the address ends with the API base (for example /Competitionuat/api/v1).` });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const describe = (key: string) => {
    const a = keyToAction(key);
    if (!a) return 'Not used';
    if (a.kind === 'send') return 'Send';
    if (a.kind === 'cancel') return 'Cancel';
    return `${a.kind === 'major' ? '−0.3' : a.kind === 'minor' ? '−0.1' : 'Undo'} · ${a.pos} athlete`;
  };
  const keyName = (k: string) => (k === ' ' ? 'Space' : k);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right']}>
      <MatchBar onHome={() => router.replace('/')} category="Device connection" roleLabel="This tablet" connection={pill} draft={false} compact={!wide} />
      <KeypadCapture active={!editing} onKey={(k) => setLastKey({ key: keyName(k), text: describe(k) })} />
      <ScrollView contentContainerStyle={[styles.body, wide && { maxWidth: 1100, alignSelf: 'center', width: '100%' }]} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[4], alignItems: 'flex-start' }}>
          <View style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch', gap: space[4] }}>
            <Panel>
              <View style={styles.head}>
                <Txt v="overline" color="inkMuted">Network</Txt>
                <StatusPill status={pill} label={link.label} />
              </View>
              <KV k="Link">{link.kind === 'wired' ? 'USB-C Ethernet cable' : link.kind === 'wifi' ? 'Wi-Fi' : link.connected ? link.label : 'Not connected'}</KV>
              <KV k="This tablet's address">{ip ?? '—'}</KV>
              {link.kind === 'wired' ? (
                <Notice tone="ok" text="Wired link active. Scores go over the cable; Wi-Fi can stay off." />
              ) : link.kind === 'wifi' ? (
                <Notice tone="info" text="On Wi-Fi. Plug in the USB-C Ethernet adapter for a wired link: the tablet switches to the cable on its own." />
              ) : !link.connected ? (
                <Notice text="No network. Check the USB-C cable and adapter, or turn on Wi-Fi." />
              ) : null}
            </Panel>

            <Panel>
              <Txt v="overline" color="inkMuted">Scoring server</Txt>
              <Txt v="caption" color="inkMuted">API base address of the scoring server, for example https://host/Competitionuat/api/v1. The same address works over the cable or Wi-Fi.</Txt>
              <TextInput value={url} onChangeText={(t) => { setUrl(t); setTest({ state: 'idle' }); }} placeholder="https://host/Competitionuat/api/v1" placeholderTextColor={c.inkMuted}
                autoCapitalize="none" autoCorrect={false} keyboardType="url" inputMode="url" returnKeyType="done"
                onFocus={() => setEditing(true)} onBlur={() => { setEditing(false); save(); }} onSubmitEditing={runTest}
                accessibilityLabel="Scoring server address"
                style={[styles.input, { color: c.ink, borderColor: editing ? c.gold : c.controlBorder, backgroundColor: c.surfaceSunken }]} />
              <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
                <Button label="Test connection" icon="refresh" variant="secondary" onPress={runTest} disabled={test.state === 'testing'} />
                {test.state === 'testing' ? <ActivityIndicator color={c.goldText} /> : null}
              </View>
              <Notice tone={test.state === 'ok' ? 'ok' : 'alert'} text={test.state === 'ok' || test.state === 'fail' ? test.text ?? null : null} />
              <Notice tone="info" text="The address must be the API base, ending in /api/v1. Leave it empty to use the UAT server. A saved address takes effect immediately for new requests." />
              <Button label="Live status" icon="list" variant="secondary" onPress={() => router.push('/ring-status')} />
            </Panel>
          </View>

          <View style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch', gap: space[4] }}>
            <Panel>
              <View style={styles.head}>
                <Txt v="overline" color="inkMuted">USB keypad for judges</Txt>
                <Switch value={settings.keypad} onValueChange={(v) => { updateDeviceSettings({ keypad: v }); setLastKey(null); }}
                  trackColor={{ true: c.ok, false: c.controlBorder }} accessibilityLabel="Use USB keypad" />
              </View>
              <Txt v="caption" color="inkMuted">Plug a numeric keypad into the USB-C port (or a hub). Judges can then deduct, undo and send without touching the screen. The touch controls keep working.</Txt>
              {KEYPAD_MAP.map((m) => (
                <View key={m.keys} style={[styles.keyRow, { borderBottomColor: c.hairline }]}>
                  <View style={[styles.keycap, { borderColor: c.controlBorder, backgroundColor: c.surfaceRaised }]}><Txt v="scoreMd" style={{ fontSize: 18 }}>{m.keys}</Txt></View>
                  <Txt v="body" style={{ flex: 1 }}>{m.action}</Txt>
                </View>
              ))}
              <Txt v="caption" color="inkMuted">Left keys score the athlete on the left of the judge&apos;s screen, so they follow the ⇄ side swap. Cut-off and Freestyle: both columns score the one athlete.</Txt>
            </Panel>

            <Panel>
              <Txt v="overline" color="inkMuted">Keypad test</Txt>
              {!settings.keypad ? (
                <Txt v="body" color="inkMuted">Turn the keypad on, then press any key.</Txt>
              ) : (
                <Pressable accessibilityRole="text" style={[styles.test, { borderColor: lastKey ? c.ok : c.hairline, backgroundColor: c.surfaceSunken }]}>
                  <Icon name="keypad" size={26} color={lastKey ? c.okText : c.inkMuted} />
                  <View style={{ flex: 1 }}>
                    <Txt v="title">{lastKey ? `Key ${lastKey.key}` : 'Press a key on the keypad'}</Txt>
                    <Txt v="caption" color="inkMuted">{lastKey ? lastKey.text : 'Nothing received yet'}</Txt>
                  </View>
                </Pressable>
              )}
            </Panel>

            <Panel>
              <Txt v="overline" color="inkMuted">Cable setup</Txt>
              {[
                'Network only: USB-C to Ethernet adapter, cable to the ring switch.',
                'Network and keypad: a USB-C hub with Ethernet, a USB-A port for the keypad and USB-C power in, so the tablet charges all day.',
                'Android tablets switch to the cable as soon as it is plugged in. iPad: Settings shows an Ethernet entry once the adapter is connected.',
                'Keep the screen on and the tablet charging: the judge screens stop the tablet from sleeping.',
              ].map((t) => (
                <View key={t} style={{ flexDirection: 'row', gap: space[2] }}>
                  <Icon name="cable" size={16} color={c.goldText} />
                  <Txt v="body" style={{ flex: 1 }}>{t}</Txt>
                </View>
              ))}
            </Panel>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[4], gap: space[4] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2], flexWrap: 'wrap' },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: radius.sm, paddingHorizontal: space[3], fontSize: 18 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: 1, paddingVertical: space[2] },
  keycap: { minWidth: 76, height: 40, paddingHorizontal: 8, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  test: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], borderRadius: radius.md, borderWidth: 1.5 },
});
