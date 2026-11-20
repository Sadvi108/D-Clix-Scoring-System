import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Side } from '@/core/types';
import { api } from '@/data';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';
import { AthletePlate, FormClock, MatchBar, mmss } from '@/ui/match';
import { Button, Txt, f1 } from '@/ui/primitives';
import { CriterionStepper, DeductionPad, SendButton } from '@/ui/scoring';
import { usePkSides, toggleSides } from './sideLayout';
import { receiptTime, useJudge } from './useJudge';

/** Chung vs Hong on one landscape screen: Chung keys left, criteria centre, Hong keys right, Send bottom-centre. */
export function ScoringPK() {
  useKeepAwake();
  const router = useRouter();
  const { c } = useTheme();
  const { s, cur, chung, hong, locked, sendState, pressSend, correction } = useJudge();
  const { width, height } = useWindowDimensions();
  const compact = height < 560; // phone in landscape
  const [bodyH, setBodyH] = useState(0);
  const { left: L, right: R, swapped } = usePkSides();
  if (!cur || !cur.hong) return null;
  const by = (sd: Side) => (sd === 'chung' ? chung : hong);
  const athlete = (sd: Side) => (sd === 'chung' ? cur.chung : cur.hong!);

  const keyCol = compact ? Math.max(118, Math.round(width * 0.15)) : Math.min(200, Math.round(width * 0.18));
  const gap = compact ? 10 : 14;
  const majorH = Math.max(80, Math.round((bodyH - gap - 12) * 0.58));
  const minorH = Math.max(60, Math.round((bodyH - gap - 12) * 0.42));
  const rules = s.rules;
  const major = rules.deductions.find((d) => d.code === 'ACC_03')!;
  const minor = rules.deductions.find((d) => d.code === 'ACC_01')!;

  const keys = (side: Side) => {
    const m = side === 'chung' ? chung : hong;
    return (
      <View style={{ width: keyCol, gap }}>
        <DeductionPad side={side} countLeft={side === R} kind="major" value={major.tenths / 10} count={m.major} height={majorH} disabled={locked || m.accT < major.tenths} onTap={() => api.tap(side, major.code)} />
        <DeductionPad side={side} countLeft={side === R} kind="minor" value={minor.tenths / 10} count={m.minor} height={minorH} disabled={locked || m.accT < minor.tenths} onTap={() => api.tap(side, minor.code)} />
      </View>
    );
  };
  const undo = (side: Side) => {
    const m = side === 'chung' ? chung : hong;
    return (
      <Button variant="secondary" icon="undo" label={m.lastUndoLabel ? `Undo ${m.lastUndoLabel}` : 'Undo'} disabled={locked || !m.lastUndoLabel}
        onPress={() => api.undo(side)} style={{ width: keyCol, paddingHorizontal: 8 }} accessibilityLabel={`Undo last ${side} deduction`} />
    );
  };

  const receipt = s.myDraft.receipt;
  const detail = sendState === 'sent' ? receiptTime(receipt?.receivedAt) : chung.total != null && hong.total != null ? `${f1(by(L).total)} · ${f1(by(R).total)}` : null;
  const label = sendState === 'ready' ? 'Send both scores' : sendState === 'incomplete' && compact ? 'Set every criterion' : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <MatchBar onHome={() => router.replace('/')} compact={compact} matchNo={cur.matchNo} ring={cur.ring} category={compact ? `${cur.category.replace('Male Under', 'Male U')} · ${cur.round.replace('Round of ', 'R')}` : cur.category} round={cur.round} judgeNo={s.me?.judgeNo} connection={s.connection === 'sending' ? 'sending' : 'online'} />
      <View style={[styles.plates, { paddingHorizontal: space[4], paddingTop: compact ? 6 : 12, gap }]}>
        <View style={{ flex: 1, minWidth: 0 }}><AthletePlate side={L} mirror={false} athlete={athlete(L)} accuracy={by(L).accuracy} presentation={by(L).presentation} compact={compact} /></View>
        <FormClock time={mmss(cur.clockSec)} form={cur.form} formNo={cur.formNo} formCount={cur.formCount} compact={compact} running={cur.clockRunning} />
        <View style={{ flex: 1, minWidth: 0 }}><AthletePlate side={R} mirror athlete={athlete(R)} accuracy={by(R).accuracy} presentation={by(R).presentation} compact={compact} /></View>
      </View>

      <View style={[styles.body, { paddingHorizontal: space[4], paddingTop: compact ? 8 : 12, gap }]} onLayout={(e) => setBodyH(e.nativeEvent.layout.height - (compact ? 8 : 12))}>
        {bodyH > 0 ? keys(L) : <View style={{ width: keyCol }} />}
        <View style={styles.mid}>
          {!compact ? (
            <View style={[styles.row, { marginBottom: 4 }]}>
              {[L, 'mid', R].map((k) => k === 'mid' ? (
                <View key="mid" style={styles.lbl}><Txt v="label">Accuracy</Txt><Txt v="caption" color="inkMuted">{by(L).major}M {by(L).minor}m · 4.0 max · {by(R).major}M {by(R).minor}m</Txt></View>
              ) : (
                <View key={k} style={[styles.fig, { backgroundColor: k === 'chung' ? c.chungSoft : c.hongSoft }]}><Txt v="scoreLg" color={k === 'chung' ? 'chungText' : 'hongText'} style={{ fontSize: 36, lineHeight: 40 }}>{f1(by(k as Side).accuracy)}</Txt></View>
              ))}
            </View>
          ) : null}
          {rules.criteria.map((cr, i) => (
            <View key={cr.code} style={styles.row}>
              <View style={styles.stepCol}>
                <CriterionStepper side={L} compact={compact} value={by(L).criteria[i]} min={cr.minTenths} max={cr.maxTenths} disabled={locked} onChange={(v) => api.setCriterion(L, i, v)} />
              </View>
              <View style={styles.lbl}>
                <Txt v="label" style={{ textAlign: 'center', fontSize: compact ? 12 : 14, lineHeight: compact ? 15 : 18 }}>{cr.short}</Txt>
                <Txt v="caption" color="inkMuted" style={{ textAlign: 'center', fontSize: compact ? 11 : 12 }}>{cr.sub ?? `${(cr.minTenths / 10).toFixed(1)} – ${(cr.maxTenths / 10).toFixed(1)}`}</Txt>
              </View>
              <View style={styles.stepCol}>
                <CriterionStepper side={R} compact={compact} value={by(R).criteria[i]} min={cr.minTenths} max={cr.maxTenths} disabled={locked} onChange={(v) => api.setCriterion(R, i, v)} />
              </View>
            </View>
          ))}
        </View>
        {bodyH > 0 ? keys(R) : <View style={{ width: keyCol }} />}
      </View>

      <View style={[styles.foot, { paddingHorizontal: space[4], paddingVertical: compact ? 8 : 14, gap }]}>
        {undo(L)}
        <Button icon="swap" variant="secondary" accessibilityLabel={swapped ? 'Swap sides: put Chung on the left' : 'Swap sides: put Hong on the left'}
          onPress={toggleSides} style={{ paddingHorizontal: 12, minHeight: compact ? 56 : 64 }} />
        <SendButton state={sendState} label={label} detail={detail} compact={compact} onPress={pressSend} style={{ flex: 1 }} />
        {undo(R)}
      </View>
      {correction && sendState !== 'sent' ? (
        <Txt v="caption" color="alertText" style={styles.receipt}>Chief referee reopened your score · {correction.reason}. Adjust and send revision {(receipt?.revision ?? 0) + 1}.</Txt>
      ) : null}
      {sendState === 'sent' ? (
        <Txt v="caption" color="okText" style={styles.receipt}>Received by the server · rev {receipt?.revision} · {receipt?.submissionId}. Changes now need the chief referee.</Txt>
      ) : null}
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
