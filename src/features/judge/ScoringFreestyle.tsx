import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/data';
import type { PresentationCriterion } from '@/sports/poomsae/rules';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { flag } from '@/ui/flag';
import { MatchBar, mmss } from '@/ui/match';
import { Button, Icon, RuleBadge, Txt, f1 } from '@/ui/primitives';
import { ScoreGrid } from '@/ui/scoreGrid';
import { DeductionPad, ScoreChip, ScoreSummary, SendButton } from '@/ui/scoring';
import { KeypadCapture, type KeypadAction } from '@/device/keypad';
import { receiptTime, useJudge } from './useJudge';

/**
 * Freestyle (Cut-off, one entry, blue), laid out like the judge tablet manual: −0.3 key on the left, −0.1 key on the
 * right (the round counter on a key removes one), Technical skills (6.0) and Presentation (4.0) items in the centre.
 * Tapping an item opens the number grid: Technical page, OK, Presentation page, OK. Send sends at once.
 */
export function ScoringFreestyle() {
  useKeepAwake();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const { s, cur, chung, locked, sendState, correction } = useJudge();
  const [sheet, setSheet] = useState<'closed' | 'receipt'>('closed');
  const [grid, setGrid] = useState<number | null>(null); // page to open: 0 Technical, 1 Presentation
  if (!cur) return null;

  const rules = s.rules;
  const receipt = s.myDraft.receipt;
  const sending = s.myDraft.sendState === 'sending';
  const items = rules.criteria.map((cr, i) => ({ cr, i }));
  const tech = items.filter((x) => x.cr.group === 'TECHNICAL');
  const pres = items.filter((x) => x.cr.group !== 'TECHNICAL');
  const techPts = chung.accuracy; // technical sum (running)
  const presPts = chung.presentationSoFar;
  const major = rules.deductions.find((d) => d.code === 'ACC_03');
  const minor = rules.deductions.find((d) => d.code === 'ACC_01');
  const padH = wide ? 180 : 120;

  async function send() {
    if (sendState !== 'ready' && sendState !== 'failed') return;
    const r = await api.submit();
    if (r.ok) setSheet('receipt');
  }

  // USB keypad: 7/9 = −0.3, 4/6 = −0.1 (either column), 1/3 = undo last, Enter = send.
  const onKeypad = (a: KeypadAction) => {
    if (sheet === 'receipt') { if (a.kind === 'send' || a.kind === 'cancel') setSheet('closed'); return; }
    if (a.kind === 'send') { send(); return; }
    if (a.kind === 'cancel' || locked) return;
    if (a.kind === 'undo') { if (chung.canUndo) api.undo('chung'); return; }
    const d = a.kind === 'major' ? major : minor;
    if (d) api.tap('chung', d.code);
  };

  const pad = (kind: 'major' | 'minor') => {
    const d = kind === 'major' ? major : minor;
    if (!d) return null;
    return (
      <DeductionPad side="solo" kind={kind} value={d.tenths / 10} count={kind === 'major' ? chung.major : chung.minor} height={padH}
        countLeft={kind === 'minor'} style={wide ? { width: Math.min(200, Math.round(width * 0.16)) } : { flex: 1 }}
        disabled={locked} onTap={() => api.tap('chung', d.code)} onUndo={() => api.undo('chung', d.code)} undoDisabled={locked} />
    );
  };

  const section = (title: string, max: number, got: number, list: { cr: PresentationCriterion; i: number }[], page: number) => (
    <View style={{ gap: space[2], flex: 1, minWidth: 0 }}>
      <View style={[styles.secHead, { borderBottomColor: c.hairline }]}>
        <Txt v="label" style={{ fontSize: 16 }}>{title} ({max.toFixed(1)})</Txt>
        <Txt v="scoreMd" color="chungText" style={{ fontSize: 20 }}>{f1(got)}</Txt>
      </View>
      {list.map(({ cr, i }) => (
        <View key={cr.code} style={styles.crit}>
          <Txt v="body" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{cr.short}</Txt>
          <View style={{ width: wide ? 96 : 84 }}>
            <ScoreChip side="solo" compact label={cr.short} value={chung.criteria[i]} disabled={locked} onPress={() => setGrid(page)} />
          </View>
        </View>
      ))}
    </View>
  );

  const items2 = (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? space[5] : space[4], flex: 1, minWidth: 0 }}>
      {section('Technical Skills', rules.accuracyMaxTenths / 10, techPts, tech, 0)}
      {section('Presentation', rules.presentationMaxTenths / 10, presPts, pres, 1)}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right']}>
      <KeypadCapture onAction={onKeypad} active={sheet === 'closed' && grid == null} />
      <MatchBar onHome={() => router.replace('/')} compact={!wide} matchNo={cur.matchNo} ring={wide ? cur.ring : undefined} category={cur.category} round={cur.round} judgeNo={s.me?.judgeNo} connection={wide ? 'online' : undefined} />
      <View style={[styles.who, { backgroundColor: c.chungSoft }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <View style={[styles.tag, { backgroundColor: c.chung }]}><Txt v="overline" color="#ffffff" style={{ fontSize: 10 }}>{cur.chung.entryId}</Txt></View>
            {flag(cur.chung.nat) ? <Txt style={{ fontSize: 20, lineHeight: 24 }}>{flag(cur.chung.nat)}</Txt> : null}
            <Txt v="overline" color="inkMuted">{cur.chung.nat}</Txt>
            <RuleBadge tone="draft" label="Freestyle" />
          </View>
          <Txt v="title" numberOfLines={1} style={{ textTransform: 'uppercase', fontSize: wide ? 22 : 17 }}>{cur.chung.name}</Txt>
          {cur.chung.members?.length ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{cur.chung.members.join(' · ')}</Txt> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt v="scoreHero" color={cur.clockRunning ? 'goldText' : 'ink'} style={{ fontSize: 34, lineHeight: 34 }}>{mmss(cur.clockSec)}</Txt>
          <Txt v="overline" color="inkMuted" style={{ fontSize: 10 }}>{cur.form}</Txt>
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

      {correction && sendState !== 'sent' ? (
        <Txt v="caption" color="alertText" style={{ textAlign: 'center', paddingHorizontal: space[4], paddingVertical: 6 }}>Chief referee reopened your score · {correction.reason}. Adjust and send revision {(receipt?.revision ?? 0) + 1}.</Txt>
      ) : null}
      <View style={[styles.foot, { borderTopColor: c.hairline, paddingBottom: insets.bottom + space[3] }, wide && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space[6] }]}>
        <ScoreSummary accuracy={techPts} presentation={presPts} deduction={chung.deduction} labels={['Technical', 'Presentation']} compact />
        {sendState === 'sent' ? (
          <SendButton state="sent" compact detail={receiptTime(receipt?.receivedAt)} style={wide ? { minWidth: 320 } : null} />
        ) : (
          <SendButton compact state={sending ? 'sending' : sendState} detail={chung.total != null ? f1(chung.total) : null} onPress={send} style={wide ? { minWidth: 320 } : null} />
        )}
      </View>

      <Modal visible={sheet === 'receipt'} transparent animationType="slide" onRequestClose={() => setSheet('closed')} supportedOrientations={['portrait', 'landscape']}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={() => setSheet('closed')} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.hairline, paddingBottom: insets.bottom + space[4] }, wide && { alignSelf: 'center', width: 560 }]}>
          <View style={[styles.grab, { backgroundColor: c.controlBorder }]} />
          <KeypadCapture onAction={onKeypad} active={sheet === 'receipt'} />
          <View style={{ alignItems: 'center', gap: space[3] }}>
            <View style={[styles.okm, { backgroundColor: c.okSoft, borderColor: c.ok }]}><Icon name="check" size={34} stroke={2.5} color={c.okText} /></View>
            <Txt v="title">Received by the server</Txt>
            <View style={[styles.ids, { backgroundColor: c.surfaceRaised }]}>
              <Txt v="mono" color="inkMuted">Received</Txt><Txt v="mono">{receiptTime(receipt?.receivedAt)} · {cur.ring}</Txt>
              <Txt v="mono" color="inkMuted">Submission</Txt><Txt v="mono">J{s.me?.judgeNo} · rev {receipt?.revision} · {receipt?.submissionId}</Txt>
              <Txt v="mono" color="inkMuted">Total</Txt><Txt v="mono">{f1(chung.total)}</Txt>
            </View>
            <Button label="Done" icon="check" variant="secondary" size="lg" block onPress={() => setSheet('closed')} />
          </View>
        </View>
      </Modal>

      {grid != null ? (
        <ScoreGrid side="solo" title={`${cur.chung.name} (${cur.chung.nat})`} startPage={grid}
          pages={[
            { title: `Technical Skills (${(rules.accuracyMaxTenths / 10).toFixed(1)})`, rows: tech.map(({ cr, i }) => ({ key: String(i), label: cr.short, min: cr.minTenths, max: cr.maxTenths, value: chung.criteria[i] })) },
            { title: `Presentation (${(rules.presentationMaxTenths / 10).toFixed(1)})`, rows: pres.map(({ cr, i }) => ({ key: String(i), label: cr.short, min: cr.minTenths, max: cr.maxTenths, value: chung.criteria[i] })) },
          ]}
          onOk={(v) => { Object.entries(v).forEach(([i, t]) => api.setCriterion('chung', Number(i), t)); setGrid(null); }}
          onClose={() => setGrid(null)} />
      ) : null}
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
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: space[4], gap: space[3] },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  okm: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ids: { alignSelf: 'stretch', borderRadius: radius.sm, padding: space[3], gap: 2 },
});
