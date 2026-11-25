import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { flag } from '@/ui/flag';
import { MatchBar } from '@/ui/match';
import { Txt, f1 } from '@/ui/primitives';
import { DeductionPad, LockBanner, ScoreChip, ScoreSummary, SendButton } from '@/ui/scoring';
import { ScoreGrid } from '@/ui/scoreGrid';
import { KeypadCapture, type KeypadAction } from '@/device/keypad';
import { ConfirmSend } from './ConfirmSend';
import { gridRows, keypadUndo, receiptTime, toTenths, fromTenths, type JudgeModel } from './model';

/** One athlete (Cut-off, any entry type). Tap a presentation value for the number grid; Send asks to confirm, then shows the receipt. */
export function ScoringCutoff({ j }: { j: JudgeModel }) {
  useKeepAwake();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const twoCol = width >= 900; // tablet landscape: keys on the left, presentation on the right
  const [grid, setGrid] = useState(false);
  const v = j.view;
  const chung = v.chung;
  if (!j.sheet || !chung) return null;
  const { locked, notice, sendState } = v;
  const { major, minor } = v.keys;
  const items = j.sheet.sections[1].items;
  const calc = chung.calc;
  const accuracy = calc?.acc ?? null;
  const presentation = calc?.ok ? calc.pres : null;
  const total = calc?.ok ? calc.tot : null;

  const send = j.pressSend;

  // USB keypad: either column scores the one athlete; Enter sends.
  const onKeypad = (a: KeypadAction) => {
    if (a.kind === 'send') { send(); return; }
    if (a.kind === 'cancel' || locked) return;
    if (a.kind === 'undo') { const code = keypadUndo(chung.local, v.keys); if (code) j.undo('chung', code); return; }
    const k = a.kind === 'major' ? major : minor;
    if (k && chung.can[k.code]) j.tap('chung', k.code);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right']}>
      <KeypadCapture onAction={onKeypad} active={!grid && !j.confirming} />
      <MatchBar onHome={() => router.push('/ring-status')} compact={!wide} matchNo={v.gameNo} ring={wide ? `Ring ${v.ring}` : undefined} category={wide ? v.category : v.category.replace(' · Cut-off', '')} round={v.round} judgeNo={v.seat ?? undefined} connection={wide ? (v.conn ? 'online' : 'offline') : undefined} />
      {notice ? <LockBanner icon={notice.icon} text={notice.text} /> : null}
      <View style={[styles.who, { backgroundColor: c.chungSoft }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <View style={[styles.tag, { backgroundColor: c.chung }]}><Txt v="overline" color="#ffffff" style={{ fontSize: 10 }}>{chung.athlete.entryId}</Txt></View>
            {flag(chung.athlete.nat) ? <Txt style={{ fontSize: 20, lineHeight: 24 }}>{flag(chung.athlete.nat)}</Txt> : null}
            <Txt v="overline" color="inkMuted">{chung.athlete.nat}</Txt>
          </View>
          <Txt v="title" numberOfLines={1} style={{ textTransform: 'uppercase', fontSize: wide ? 22 : 17 }}>{chung.athlete.name}</Txt>
          {chung.athlete.members?.length ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{chung.athlete.members.join(' · ')}</Txt> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt v="scoreHero" color={v.clock.running ? 'goldText' : 'ink'} style={{ fontSize: 34, lineHeight: 34 }}>{v.clock.text}</Txt>
          <Txt v="overline" color="inkMuted" style={{ fontSize: 10 }}>{v.formName} · F{v.formNo}/{v.formCount}</Txt>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, wide && { maxWidth: twoCol ? 1200 : 720, alignSelf: 'center', width: '100%' }, twoCol && { flexDirection: 'row', gap: space[6], alignItems: 'flex-start' }]} scrollEnabled={twoCol}>
        <View style={{ gap: space[3], flex: twoCol ? 1 : undefined }}>
        <View style={styles.keys}>
          {major ? <DeductionPad side="solo" kind="major" value={Math.abs(major.value)} count={chung.local.ded[major.code] ?? 0} height={twoCol ? 260 : wide ? 200 : 168} style={{ flex: 1.2 }} disabled={locked || !chung.can[major.code]} onTap={() => j.tap('chung', major.code)} onUndo={() => j.undo('chung', major.code)} undoDisabled={locked} /> : null}
          {minor ? <DeductionPad side="solo" kind="minor" value={Math.abs(minor.value)} count={chung.local.ded[minor.code] ?? 0} height={twoCol ? 260 : wide ? 200 : 168} style={{ flex: 1 }} disabled={locked || !chung.can[minor.code]} onTap={() => j.tap('chung', minor.code)} onUndo={() => j.undo('chung', minor.code)} undoDisabled={locked} /> : null}
        </View>
        <View style={styles.accRow}>
          <Txt v="caption" color="inkMuted" style={{ flex: 1 }}>Tap the round counter on a key to remove one of that deduction.</Txt>
          <View style={{ alignItems: 'flex-end', paddingRight: 4 }}>
            <Txt v="overline" color="inkMuted" style={{ fontSize: 10 }}>{j.sheet.sections[0].label}</Txt>
            <Txt v="scoreLg">{f1(accuracy)}</Txt>
          </View>
        </View>
        </View>
        <View style={{ gap: space[3], flex: twoCol ? 1 : undefined, paddingTop: twoCol ? space[2] : 0 }}>
          {twoCol ? <Txt v="overline" color="inkMuted">Presentation · tap a score to open the number grid</Txt> : null}
        {items.map((it) => (
          <View key={it.code} style={styles.crit}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="label">{it.label}</Txt>
              <Txt v="caption" color="inkMuted">{it.hint ?? `${it.min.toFixed(1)} – ${it.max.toFixed(1)}`}</Txt>
            </View>
            <View style={{ width: twoCol ? 220 : 164 }}>
              <ScoreChip side="solo" compact label={it.label} value={toTenths(chung.local.items[it.code])} disabled={locked} onPress={() => setGrid(true)} />
            </View>
          </View>
        ))}
        </View>
      </ScrollView>

      {v.sendError && sendState === 'failed' ? (
        <Txt v="caption" color="alertText" style={{ textAlign: 'center', paddingHorizontal: space[4], paddingVertical: 6 }}>Not sent: {v.sendError}</Txt>
      ) : null}
      <View style={[styles.foot, { borderTopColor: c.hairline, paddingBottom: insets.bottom + space[3] }, wide && { alignItems: 'center' }]}>
        <ScoreSummary accuracy={accuracy} presentation={presentation} compact />
        {sendState === 'sent' ? (
          <SendButton state="sent" compact detail={receiptTime(v.receiptAt)} style={wide ? { minWidth: 360 } : null} />
        ) : (
          <SendButton compact state={sendState} label={sendState === 'ready' ? `Send Form ${v.formNo}` : undefined} detail={total != null ? f1(total) : null} onPress={send} style={wide ? { minWidth: 360 } : null} />
        )}
      </View>

      {grid ? (
        <ScoreGrid side="solo" title={`${chung.athlete.name} (${chung.athlete.nat})`}
          pages={[{ title: j.sheet.sections[1].label, rows: gridRows(items, chung.local) }]}
          onOk={(vals) => { j.setItems('chung', fromTenths(vals)); setGrid(false); }}
          onClose={() => setGrid(false)} />
      ) : null}
      <ConfirmSend j={j} />
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  tag: { height: 20, paddingHorizontal: 6, borderRadius: radius.sm, justifyContent: 'center' },
  body: { padding: space[4], gap: space[3] },
  keys: { flexDirection: 'row', gap: 10 },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  crit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foot: { borderTopWidth: 1, paddingHorizontal: space[4], paddingTop: space[3], gap: 10, marginTop: 'auto' },
});
