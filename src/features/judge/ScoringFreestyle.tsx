import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SheetItem } from '@/api/types';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { flag } from '@/ui/flag';
import { MatchBar } from '@/ui/match';
import { RuleBadge, Txt, f1 } from '@/ui/primitives';
import { ScoreGrid } from '@/ui/scoreGrid';
import { DeductionPad, LockBanner, ScoreChip, ScoreSummary, SendButton } from '@/ui/scoring';
import { KeypadCapture, type KeypadAction } from '@/device/keypad';
import { ConfirmSend } from './ConfirmSend';
import { gridRows, keypadUndo, receiptTime, toTenths, fromTenths, type JudgeModel } from './model';

/**
 * Freestyle (Cut-off, one entry, blue), laid out like the judge tablet manual: −0.3 key on the left, −0.1 key on the
 * right (the round counter on a key removes one), Technical skills (6.0) and Presentation (4.0) items in the centre.
 * Tapping an item opens the number grid: Technical page, OK, Presentation page, OK. Send asks to confirm.
 */
export function ScoringFreestyle({ j }: { j: JudgeModel }) {
  useKeepAwake();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const [grid, setGrid] = useState<number | null>(null); // page to open: 0 Technical, 1 Presentation
  const v = j.view;
  const chung = v.chung;
  if (!j.sheet || !chung) return null;
  const { locked, notice, sendState } = v;
  const { major, minor } = v.keys;
  const [secA, secB] = j.sheet.sections;
  const tech = secA.items ?? [];
  const pres = secB.items;
  const presMax = Math.round(pres.reduce((a, it) => a + it.max, 0) * 10) / 10;
  const cl = chung.calc;
  const techPts = cl?.techSum ?? null; // technical sum (running)
  const presPts = cl?.ok ? cl.presSum : null;
  const ded = cl?.ded ?? 0;
  const total = cl?.ok ? cl.tot : null;
  const padH = wide ? 180 : 120;

  const send = j.pressSend;

  // USB keypad: 7/9 = −0.3, 4/6 = −0.1 (either column), 1/3 = undo last, Enter = send.
  const onKeypad = (a: KeypadAction) => {
    if (a.kind === 'send') { send(); return; }
    if (a.kind === 'cancel' || locked) return;
    if (a.kind === 'undo') { const code = keypadUndo(chung.local, v.keys); if (code) j.undo('chung', code); return; }
    const k = a.kind === 'major' ? major : minor;
    if (k) j.tap('chung', k.code);
  };

  const pad = (kind: 'major' | 'minor') => {
    const d = kind === 'major' ? major : minor;
    if (!d) return null;
    return (
      <DeductionPad side="solo" kind={kind} value={Math.abs(d.value)} count={chung.local.ded[d.code] ?? 0} height={padH}
        countLeft={kind === 'minor'} style={wide ? { width: Math.min(200, Math.round(width * 0.16)) } : { flex: 1 }}
        disabled={locked} onTap={() => j.tap('chung', d.code)} onUndo={() => j.undo('chung', d.code)} undoDisabled={locked} />
    );
  };

  const section = (title: string, max: number, got: number | null, list: SheetItem[], page: number) => (
    <View style={{ gap: space[2], flex: 1, minWidth: 0 }}>
      <View style={[styles.secHead, { borderBottomColor: c.hairline }]}>
        <Txt v="label" style={{ fontSize: 16 }}>{title} ({max.toFixed(1)})</Txt>
        <Txt v="scoreMd" color="chungText" style={{ fontSize: 20 }}>{f1(got)}</Txt>
      </View>
      {list.map((it) => (
        <View key={it.code} style={styles.crit}>
          <Txt v="body" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{it.label}</Txt>
          <View style={{ width: wide ? 96 : 84 }}>
            <ScoreChip side="solo" compact label={it.label} value={toTenths(chung.local.items[it.code])} disabled={locked} onPress={() => setGrid(page)} />
          </View>
        </View>
      ))}
    </View>
  );

  const items2 = (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? space[5] : space[4], flex: 1, minWidth: 0 }}>
      {section(secA.label, secA.max, techPts, tech, 0)}
      {section(secB.label, presMax, presPts, pres, 1)}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right']}>
      <KeypadCapture onAction={onKeypad} active={grid == null && !j.confirming} />
      <MatchBar onHome={() => router.push('/ring-status')} compact={!wide} matchNo={v.gameNo} ring={wide ? `Ring ${v.ring}` : undefined} category={v.category} round={v.round} judgeNo={v.seat ?? undefined} connection={wide ? (v.conn ? 'online' : 'offline') : undefined} />
      {notice ? <LockBanner icon={notice.icon} text={notice.text} /> : null}
      <View style={[styles.who, { backgroundColor: c.chungSoft }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <View style={[styles.tag, { backgroundColor: c.chung }]}><Txt v="overline" color="#ffffff" style={{ fontSize: 10 }}>{chung.athlete.entryId}</Txt></View>
            {flag(chung.athlete.nat) ? <Txt style={{ fontSize: 20, lineHeight: 24 }}>{flag(chung.athlete.nat)}</Txt> : null}
            <Txt v="overline" color="inkMuted">{chung.athlete.nat}</Txt>
            <RuleBadge tone="draft" label="Freestyle" />
          </View>
          <Txt v="title" numberOfLines={1} style={{ textTransform: 'uppercase', fontSize: wide ? 22 : 17 }}>{chung.athlete.name}</Txt>
          {chung.athlete.members?.length ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{chung.athlete.members.join(' · ')}</Txt> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt v="scoreHero" color={v.clock.running ? 'goldText' : 'ink'} style={{ fontSize: 34, lineHeight: 34 }}>{v.clock.text}</Txt>
          <Txt v="overline" color="inkMuted" style={{ fontSize: 10 }}>{v.formName}</Txt>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, wide && { maxWidth: 1200, alignSelf: 'center', width: '100%' }]}>
        {wide ? (
          <View style={{ flexDirection: 'row', gap: space[5], alignItems: 'flex-start' }}>
            {pad('major')}
            {items2}
            {pad('minor')}
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>{pad('major')}{pad('minor')}</View>
            {items2}
          </>
        )}
        <Txt v="caption" color="inkMuted">Draft items. Tap a score to open the number grid. −0.3 / −0.1 come off the total. Time and boundary penalties are applied by the referee.</Txt>
      </ScrollView>

      {v.sendError && sendState === 'failed' ? (
        <Txt v="caption" color="alertText" style={{ textAlign: 'center', paddingHorizontal: space[4], paddingVertical: 6 }}>Not sent: {v.sendError}</Txt>
      ) : null}
      <View style={[styles.foot, { borderTopColor: c.hairline, paddingBottom: insets.bottom + space[3] }, wide && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[6] }]}>
        <ScoreSummary accuracy={techPts} presentation={presPts} deduction={ded} labels={[secA.label, secB.label]} compact />
        {sendState === 'sent' ? (
          <SendButton state="sent" compact detail={receiptTime(v.receiptAt)} style={wide ? { minWidth: 320 } : null} />
        ) : (
          <SendButton compact state={sendState} detail={total != null ? f1(total) : null} onPress={send} style={wide ? { minWidth: 320 } : null} />
        )}
      </View>


      {grid != null ? (
        <ScoreGrid side="solo" title={`${chung.athlete.name} (${chung.athlete.nat})`} startPage={grid}
          pages={[
            { title: `${secA.label} (${secA.max.toFixed(1)})`, rows: gridRows(tech, chung.local) },
            { title: `${secB.label} (${presMax.toFixed(1)})`, rows: gridRows(pres, chung.local) },
          ]}
          onOk={(vals) => { j.setItems('chung', fromTenths(vals)); setGrid(null); }}
          onClose={() => setGrid(null)} />
      ) : null}
      <ConfirmSend j={j} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  tag: { height: 20, paddingHorizontal: 6, borderRadius: radius.sm, justifyContent: 'center' },
  body: { padding: space[4], gap: space[4] },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderBottomWidth: 1, paddingBottom: 6 },
  crit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foot: { borderTopWidth: 1, paddingHorizontal: space[4], paddingTop: space[3], gap: 10 },
});
