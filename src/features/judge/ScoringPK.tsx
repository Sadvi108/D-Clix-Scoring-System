import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Side } from '@/live/judgeView';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';
import { AthletePlate, FormClock, MatchBar } from '@/ui/match';
import { Button, Txt, f1 } from '@/ui/primitives';
import { DeductionPad, LockBanner, ScoreChip, SendButton } from '@/ui/scoring';
import { ScoreGrid } from '@/ui/scoreGrid';
import { KeypadCapture, type KeypadAction } from '@/device/keypad';
import { usePkSides, toggleSides } from './sideLayout';
import { ConfirmSend } from './ConfirmSend';
import { gridRows, keypadUndo, receiptTime, toTenths, fromTenths, type JudgeModel } from './model';

/**
 * Chung vs Hong on one landscape screen: deduction keys on each side (the round counter on a key removes one of that
 * deduction), presentation in the centre (tap a value to open the number grid), Send bottom-centre (asks to confirm).
 */
export function ScoringPK({ j }: { j: JudgeModel }) {
  useKeepAwake();
  const router = useRouter();
  const { c } = useTheme();
  const v = j.view;
  const { locked, notice, sendState } = v;
  const { width, height } = useWindowDimensions();
  const compact = height < 560; // phone in landscape
  const [bodyH, setBodyH] = useState(0);
  const [grid, setGrid] = useState<Side | null>(null);
  const { left: L, right: R, swapped } = usePkSides();
  if (!j.sheet || !v.chung || !v.hong) return null;
  const by = (sd: Side) => v[sd]!;
  const athlete = (sd: Side) => by(sd).athlete;
  const accSec = j.sheet.sections[0];
  const items = j.sheet.sections[1].items;
  const { major, minor } = v.keys;
  const countMajor = (sd: Side) => (major ? by(sd).local.ded[major.code] ?? 0 : 0);
  const countMinor = (sd: Side) => (minor ? by(sd).local.ded[minor.code] ?? 0 : 0);
  const accOf = (sd: Side) => by(sd).calc?.acc ?? null;
  const presOf = (sd: Side) => { const cl = by(sd).calc; return cl?.ok ? cl.pres : null; };
  const totOf = (sd: Side) => { const cl = by(sd).calc; return cl?.ok ? cl.tot : null; };

  const keyCol = compact ? Math.max(118, Math.round(width * 0.15)) : Math.min(200, Math.round(width * 0.18));
  const gap = compact ? 10 : 14;
  const majorH = Math.max(80, Math.round((bodyH - gap - 12) * 0.58));
  const minorH = Math.max(60, Math.round((bodyH - gap - 12) * 0.42));

  const keys = (side: Side) => {
    const m = by(side);
    return (
      <View style={{ width: keyCol, gap }}>
        {major ? <DeductionPad side={side} countLeft={side === R} kind="major" value={Math.abs(major.value)} count={m.local.ded[major.code] ?? 0} height={majorH} disabled={locked || !m.can[major.code]} onTap={() => j.tap(side, major.code)} onUndo={() => j.undo(side, major.code)} undoDisabled={locked} /> : null}
        {minor ? <DeductionPad side={side} countLeft={side === R} kind="minor" value={Math.abs(minor.value)} count={m.local.ded[minor.code] ?? 0} height={minorH} disabled={locked || !m.can[minor.code]} onTap={() => j.tap(side, minor.code)} onUndo={() => j.undo(side, minor.code)} undoDisabled={locked} /> : null}
      </View>
    );
  };
  // USB keypad: left column scores the athlete on the left of this screen, right column the right one.
  const onKeypad = (a: KeypadAction) => {
    if (a.kind === 'send') { j.pressSend(); return; }
    if (a.kind === 'cancel' || locked) return;
    const side = a.pos === 'left' ? L : R;
    const m = by(side);
    if (a.kind === 'undo') { const code = keypadUndo(m.local, v.keys); if (code) j.undo(side, code); return; }
    const k = a.kind === 'major' ? major : minor;
    if (k && m.can[k.code]) j.tap(side, k.code);
  };

  const detail = sendState === 'sent' ? receiptTime(v.receiptAt) : totOf('chung') != null && totOf('hong') != null ? `${f1(totOf(L))} · ${f1(totOf(R))}` : null;
  const label = sendState === 'ready' ? 'Send both scores' : sendState === 'incomplete' && compact ? 'Score every item' : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <KeypadCapture onAction={onKeypad} active={!grid && !j.confirming} />
      <MatchBar onHome={() => router.push('/ring-status')} compact={compact} matchNo={v.gameNo} ring={`Ring ${v.ring}`} category={compact ? `${v.category.replace('Male Under', 'Male U')} · ${v.round.replace('Round of ', 'R')}` : v.category} round={v.round} judgeNo={v.seat ?? undefined} connection={v.conn ? 'online' : 'offline'} />
      {notice ? <LockBanner icon={notice.icon} text={notice.text} /> : null}
      <View style={[styles.plates, { paddingHorizontal: space[4], paddingTop: compact ? 6 : 12, gap }]}>
        <View style={{ flex: 1, minWidth: 0 }}><AthletePlate side={L} mirror={false} athlete={athlete(L)} accuracy={accOf(L)} presentation={presOf(L)} compact={compact} /></View>
        <FormClock time={v.clock.text} form={v.formName} formNo={v.formNo} formCount={v.formCount} compact={compact} running={v.clock.running} />
        <View style={{ flex: 1, minWidth: 0 }}><AthletePlate side={R} mirror athlete={athlete(R)} accuracy={accOf(R)} presentation={presOf(R)} compact={compact} /></View>
      </View>

      <View style={[styles.body, { paddingHorizontal: space[4], paddingTop: compact ? 8 : 12, gap }]} onLayout={(e) => setBodyH(e.nativeEvent.layout.height - (compact ? 8 : 12))}>
        {bodyH > 0 ? keys(L) : <View style={{ width: keyCol }} />}
        <View style={styles.mid}>
          {!compact ? (
            <View style={[styles.row, { marginBottom: 4 }]}>
              {[L, 'mid', R].map((k) => k === 'mid' ? (
                <View key="mid" style={styles.lbl}><Txt v="label">{accSec.label}</Txt><Txt v="caption" color="inkMuted">{`${countMajor(L)}M ${countMinor(L)}m · ${accSec.max.toFixed(1)} max · ${countMajor(R)}M ${countMinor(R)}m`}</Txt></View>
              ) : (
                <View key={k} style={[styles.fig, { backgroundColor: k === 'chung' ? c.chungSoft : c.hongSoft }]}><Txt v="scoreLg" color={k === 'chung' ? 'chungText' : 'hongText'} style={{ fontSize: 36, lineHeight: 40 }}>{f1(accOf(k as Side))}</Txt></View>
              ))}
            </View>
          ) : null}
          {items.map((it) => (
            <View key={it.code} style={styles.row}>
              <View style={styles.stepCol}>
                <ScoreChip side={L} compact={compact} label={it.label} value={toTenths(by(L).local.items[it.code])} disabled={locked} onPress={() => setGrid(L)} />
              </View>
              <View style={styles.lbl}>
                <Txt v="label" style={{ textAlign: 'center', fontSize: compact ? 12 : 14, lineHeight: compact ? 15 : 18 }}>{it.label}</Txt>
                <Txt v="caption" color="inkMuted" style={{ textAlign: 'center', fontSize: compact ? 11 : 12 }}>{it.hint ?? `${it.min.toFixed(1)} – ${it.max.toFixed(1)}`}</Txt>
              </View>
              <View style={styles.stepCol}>
                <ScoreChip side={R} compact={compact} label={it.label} value={toTenths(by(R).local.items[it.code])} disabled={locked} onPress={() => setGrid(R)} />
              </View>
            </View>
          ))}
        </View>
        {bodyH > 0 ? keys(R) : <View style={{ width: keyCol }} />}
      </View>

      <View style={[styles.foot, { paddingHorizontal: space[4], paddingVertical: compact ? 8 : 14, gap }]}>
        <Button icon="swap" variant="secondary" accessibilityLabel={swapped ? 'Swap sides: put Chung on the left' : 'Swap sides: put Hong on the left'}
          onPress={toggleSides} style={{ paddingHorizontal: 12, minHeight: compact ? 56 : 64 }} />
        <SendButton state={sendState} label={label} detail={detail} compact={compact} onPress={j.pressSend} style={{ flex: 1 }} />
      </View>
      {v.sendError && sendState === 'failed' ? (
        <Txt v="caption" color="alertText" style={styles.receipt}>Not sent: {v.sendError}</Txt>
      ) : null}
      {sendState === 'sent' ? (
        <Txt v="caption" color="okText" style={styles.receipt}>Received by the server{v.receiptAt ? ` · ${receiptTime(v.receiptAt)}` : ''}. Changes now need the chief referee.</Txt>
      ) : null}
      {grid ? (
        <ScoreGrid side={grid} title={`${athlete(grid).name} (${athlete(grid).nat})`}
          pages={[{ title: j.sheet.sections[1].label, rows: gridRows(items, by(grid).local) }]}
          onOk={(vals) => { j.setItems(grid, fromTenths(vals)); setGrid(null); }}
          onClose={() => setGrid(null)} />
      ) : null}
      <ConfirmSend j={j} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  plates: { flexDirection: 'row', alignItems: 'center' },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  mid: { flex: 1, justifyContent: 'center', gap: 8, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCol: { flex: 1, maxWidth: 200, minWidth: 140 },
  lbl: { flex: 1, minWidth: 80, alignItems: 'center' },
  fig: { flex: 1, maxWidth: 200, minWidth: 140, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center' },
  receipt: { textAlign: 'center', paddingBottom: 6, fontSize: 11 },
});
