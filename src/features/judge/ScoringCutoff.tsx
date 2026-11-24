import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/data';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { flag } from '@/ui/flag';
import { MatchBar, mmss } from '@/ui/match';
import { Txt, f1 } from '@/ui/primitives';
import { DeductionPad, LockBanner, ScoreChip, ScoreSummary, SendButton } from '@/ui/scoring';
import { ScoreGrid } from '@/ui/scoreGrid';
import { KeypadCapture, type KeypadAction } from '@/device/keypad';
import { ConfirmSend } from './ConfirmSend';
import { receiptTime, useJudge } from './useJudge';

/** One athlete (Cut-off, any entry type). Tap a presentation value for the number grid; Send asks to confirm, then shows the receipt. */
export function ScoringCutoff() {
  useKeepAwake();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const twoCol = width >= 900; // tablet landscape: keys on the left, presentation on the right
  const j = useJudge();
  const { s, cur, chung, locked, notice, sendState, correction, confirming, pressSend } = j;
  const [grid, setGrid] = useState(false);
  if (!cur) return null;

  const rules = s.rules;
  const major = rules.deductions.find((d) => d.code === 'ACC_03')!;
  const minor = rules.deductions.find((d) => d.code === 'ACC_01')!;
  const receipt = s.myDraft.receipt;
  const sending = s.myDraft.sendState === 'sending';

  const send = pressSend;

  // USB keypad: either column scores the one athlete; Enter sends.
  const onKeypad = (a: KeypadAction) => {
    if (a.kind === 'send') { send(); return; }
    if (a.kind === 'cancel' || locked) return;
    if (a.kind === 'undo') { if (chung.canUndo) api.undo('chung'); return; }
    const d = a.kind === 'major' ? major : minor;
    if (chung.accT >= d.tenths) api.tap('chung', d.code);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right']}>
      <KeypadCapture onAction={onKeypad} active={!grid && !confirming} />
      <MatchBar onHome={() => router.replace('/')} compact={!wide} matchNo={cur.matchNo} ring={wide ? cur.ring : undefined} category={wide ? cur.category : cur.category.replace(' · Cut-off', '')} round={cur.round} judgeNo={s.me?.judgeNo} connection={wide ? 'online' : undefined} />
      {notice ? <LockBanner icon={notice.icon} text={notice.text} /> : null}
      <View style={[styles.who, { backgroundColor: c.chungSoft }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <View style={[styles.tag, { backgroundColor: c.chung }]}><Txt v="overline" color="#ffffff" style={{ fontSize: 10 }}>{cur.chung.entryId}</Txt></View>
            {flag(cur.chung.nat) ? <Txt style={{ fontSize: 20, lineHeight: 24 }}>{flag(cur.chung.nat)}</Txt> : null}
            <Txt v="overline" color="inkMuted">{cur.chung.nat}</Txt>
          </View>
          <Txt v="title" numberOfLines={1} style={{ textTransform: 'uppercase', fontSize: wide ? 22 : 17 }}>{cur.chung.name}</Txt>
          {cur.chung.members?.length ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{cur.chung.members.join(' · ')}</Txt> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt v="scoreHero" color={cur.clockRunning ? 'goldText' : 'ink'} style={{ fontSize: 34, lineHeight: 34 }}>{mmss(cur.clockSec)}</Txt>
          <Txt v="overline" color="inkMuted" style={{ fontSize: 10 }}>{cur.form} · F{cur.formNo}/{cur.formCount}</Txt>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.body, wide && { maxWidth: twoCol ? 1200 : 720, alignSelf: 'center', width: '100%' }, twoCol && { flexDirection: 'row', gap: space[6], alignItems: 'flex-start' }]} scrollEnabled={twoCol}>
        <View style={{ gap: space[3], flex: twoCol ? 1 : undefined }}>
        <View style={styles.keys}>
          <DeductionPad side="solo" kind="major" value={major.tenths / 10} count={chung.major} height={twoCol ? 260 : wide ? 200 : 168} style={{ flex: 1.2 }} disabled={locked || chung.accT < major.tenths} onTap={() => api.tap('chung', major.code)} onUndo={() => api.undo('chung', major.code)} undoDisabled={locked} />
          <DeductionPad side="solo" kind="minor" value={minor.tenths / 10} count={chung.minor} height={twoCol ? 260 : wide ? 200 : 168} style={{ flex: 1 }} disabled={locked || chung.accT < minor.tenths} onTap={() => api.tap('chung', minor.code)} onUndo={() => api.undo('chung', minor.code)} undoDisabled={locked} />
        </View>
        <View style={styles.accRow}>
          <Txt v="caption" color="inkMuted" style={{ flex: 1 }}>Tap the round counter on a key to remove one of that deduction.</Txt>
          <View style={{ alignItems: 'flex-end', paddingRight: 4 }}>
            <Txt v="overline" color="inkMuted" style={{ fontSize: 10 }}>Accuracy</Txt>
            <Txt v="scoreLg">{f1(chung.accuracy)}</Txt>
          </View>
        </View>
        </View>
        <View style={{ gap: space[3], flex: twoCol ? 1 : undefined, paddingTop: twoCol ? space[2] : 0 }}>
          {twoCol ? <Txt v="overline" color="inkMuted">Presentation · tap a score to open the number grid</Txt> : null}
        {rules.criteria.map((cr, i) => (
          <View key={cr.code} style={styles.crit}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="label">{cr.short}</Txt>
              <Txt v="caption" color="inkMuted">{cr.sub ?? `${(cr.minTenths / 10).toFixed(1)} – ${(cr.maxTenths / 10).toFixed(1)}`}</Txt>
            </View>
            <View style={{ width: twoCol ? 220 : 164 }}>
              <ScoreChip side="solo" compact label={cr.short} value={chung.criteria[i]} disabled={locked} onPress={() => setGrid(true)} />
            </View>
          </View>
        ))}
        </View>
      </ScrollView>

      {correction && sendState !== 'sent' ? (
        <Txt v="caption" color="alertText" style={{ textAlign: 'center', paddingHorizontal: space[4], paddingVertical: 6 }}>Chief referee reopened your score · {correction.reason}. Adjust and send revision {(receipt?.revision ?? 0) + 1}.</Txt>
      ) : null}
      <View style={[styles.foot, { borderTopColor: c.hairline, paddingBottom: insets.bottom + space[3] }, wide && { alignItems: 'center' }]}>
        <ScoreSummary accuracy={chung.accuracy} presentation={chung.presentation} compact />
        {sendState === 'sent' ? (
          <SendButton state="sent" compact detail={receiptTime(receipt?.receivedAt)} style={wide ? { minWidth: 360 } : null} />
        ) : (
          <SendButton compact state={sending ? 'sending' : sendState} label={sendState === 'ready' ? `Send Form ${cur.formNo}` : undefined} detail={chung.total != null ? f1(chung.total) : null} onPress={send} style={wide ? { minWidth: 360 } : null} />
        )}
      </View>

      {grid ? (
        <ScoreGrid side="solo" title={`${cur.chung.name} (${cur.chung.nat})`}
          pages={[{ title: 'Presentation', rows: rules.criteria.map((cr, i) => ({ key: String(i), label: cr.short, sub: cr.sub, min: cr.minTenths, max: cr.maxTenths, value: chung.criteria[i] })) }]}
          onOk={(v) => { Object.entries(v).forEach(([i, t]) => api.setCriterion('chung', Number(i), t)); setGrid(false); }}
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
