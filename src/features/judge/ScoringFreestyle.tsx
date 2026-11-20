import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/data';
import type { PresentationCriterion } from '@/sports/poomsae/rules';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { MatchBar, mmss } from '@/ui/match';
import { Button, Icon, RuleBadge, Txt, f1 } from '@/ui/primitives';
import { CriterionStepper, ScoreSummary, SendButton } from '@/ui/scoring';
import { KeypadCapture, type KeypadAction } from '@/device/keypad';
import { receiptTime, useJudge } from './useJudge';

/**
 * Freestyle (Cut-off, one entry, blue). Different from Recognized: no deduction keys —
 * the judge scores every Technical-skills item (6.0) and every Presentation item (4.0).
 */
export function ScoringFreestyle() {
  useKeepAwake();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 700;
  const twoCol = width >= 960; // tablet landscape: Technical and Presentation side by side
  const { s, cur, chung, locked, sendState, correction } = useJudge();
  const [sheet, setSheet] = useState<'closed' | 'review' | 'receipt'>('closed');
  if (!cur) return null;

  const rules = s.rules;
  const receipt = s.myDraft.receipt;
  const sending = s.myDraft.sendState === 'sending';
  const items = rules.criteria.map((cr, i) => ({ cr, i }));
  const tech = items.filter((x) => x.cr.group === 'TECHNICAL');
  const pres = items.filter((x) => x.cr.group !== 'TECHNICAL');
  const techPts = chung.accuracy; // technical sum (running)
  const presPts = chung.presentationSoFar;

  async function send() {
    const r = await api.submit();
    if (r.ok) setSheet('receipt');
  }

  // USB keypad: Freestyle has no deduction keys, so only Enter (review, then send) and cancel apply.
  const onKeypad = (a: KeypadAction) => {
    if (sheet === 'review') { if (a.kind === 'send' && !sending) send(); else if (a.kind === 'cancel' && !sending) setSheet('closed'); return; }
    if (sheet === 'receipt') { if (a.kind === 'send' || a.kind === 'cancel') setSheet('closed'); return; }
    if (a.kind === 'send' && sendState !== 'incomplete' && sendState !== 'sent') setSheet('review');
  };

  const section = (title: string, max: number, got: number, list: { cr: PresentationCriterion; i: number }[]) => (
    <View style={{ gap: space[2] }}>
      <View style={[styles.secHead, { borderBottomColor: c.hairline }]}>
        <Txt v="overline" color="chungText">{title}</Txt>
        <Txt v="scoreMd" style={{ fontSize: 20 }}>{f1(got)} <Txt v="caption" color="inkMuted">/ {max.toFixed(1)}</Txt></Txt>
      </View>
      {list.map(({ cr, i }) => (
        <View key={cr.code} style={styles.crit}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="label">{cr.short}</Txt>
            <Txt v="caption" color="inkMuted">{cr.sub ? `${cr.sub} · ` : ''}{(cr.minTenths / 10).toFixed(1)} – {(cr.maxTenths / 10).toFixed(1)}</Txt>
          </View>
          <View style={{ width: twoCol ? 180 : wide ? 200 : 164 }}>
            <CriterionStepper side="solo" compact value={chung.criteria[i]} min={cr.minTenths} max={cr.maxTenths} disabled={locked} onChange={(v) => api.setCriterion('chung', i, v)} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right']}>
      <KeypadCapture onAction={onKeypad} active={sheet === 'closed'} />
      <MatchBar onHome={() => router.replace('/')} compact={!wide} matchNo={cur.matchNo} ring={wide ? cur.ring : undefined} category={cur.category} round={cur.round} judgeNo={s.me?.judgeNo} connection={wide ? 'online' : undefined} />
      <View style={[styles.who, { backgroundColor: c.chungSoft }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
            <View style={[styles.tag, { backgroundColor: c.chung }]}><Txt v="overline" color="#ffffff" style={{ fontSize: 10 }}>{cur.chung.entryId}</Txt></View>
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

      <ScrollView contentContainerStyle={[styles.body, wide && { maxWidth: twoCol ? 1100 : 760, alignSelf: 'center', width: '100%' }]}>
        <View style={{ flexDirection: twoCol ? 'row' : 'column', gap: twoCol ? space[6] : space[5], alignItems: 'flex-start' }}>
          <View style={{ flex: twoCol ? 1 : undefined, alignSelf: 'stretch' }}>{section('Technical skills', rules.accuracyMaxTenths / 10, techPts, tech)}</View>
          <View style={{ flex: twoCol ? 1 : undefined, alignSelf: 'stretch' }}>{section('Presentation', rules.presentationMaxTenths / 10, presPts, pres)}</View>
        </View>
        <Txt v="caption" color="inkMuted">Draft items from the WT Freestyle score sheet. Time and boundary penalties are applied by the referee, not here.</Txt>
      </ScrollView>

      {correction && sendState !== 'sent' ? (
        <Txt v="caption" color="alertText" style={{ textAlign: 'center', paddingHorizontal: space[4], paddingVertical: 6 }}>Chief referee reopened your score · {correction.reason}. Adjust and send revision {(receipt?.revision ?? 0) + 1}.</Txt>
      ) : null}
      <View style={[styles.foot, { borderTopColor: c.hairline, paddingBottom: insets.bottom + space[3] }, wide && { alignItems: 'center' }, twoCol && { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[6] }]}>
        <ScoreSummary accuracy={techPts} presentation={presPts} labels={['Technical', 'Presentation']} compact />
        {sendState === 'sent' ? (
          <SendButton state="sent" compact detail={receiptTime(receipt?.receivedAt)} style={wide ? { minWidth: 360 } : null} />
        ) : (
          <SendButton compact state={sendState === 'incomplete' ? 'incomplete' : 'ready'} label={sendState === 'incomplete' ? 'Score every item to send' : 'Review and send'} detail={chung.total != null ? f1(chung.total) : null} onPress={() => setSheet('review')} style={wide ? { minWidth: 360 } : null} />
        )}
      </View>

      <Modal visible={sheet !== 'closed'} transparent animationType="slide" onRequestClose={() => { if (!sending) setSheet('closed'); }} supportedOrientations={['portrait', 'landscape']}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={() => sheet === 'review' && !sending && setSheet('closed')} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.hairline, paddingBottom: insets.bottom + space[4] }, wide && { alignSelf: 'center', width: 560 }]}>
          <View style={[styles.grab, { backgroundColor: c.controlBorder }]} />
          <KeypadCapture onAction={onKeypad} active={sheet !== 'closed'} />
          {sheet === 'receipt' ? (
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
          ) : (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: space[2] }}>
              <Txt v="title">Send Freestyle score for {cur.chung.entryId}?</Txt>
              <Txt v="overline" color="chungText">Technical skills · {f1(techPts)}</Txt>
              {tech.map(({ cr, i }) => <Line key={cr.code} k={cr.short} v={f1(chung.criteria[i] == null ? null : chung.criteria[i]! / 10)} />)}
              <Txt v="overline" color="chungText" style={{ marginTop: space[2] }}>Presentation · {f1(presPts)}</Txt>
              {pres.map(({ cr, i }) => <Line key={cr.code} k={cr.short} v={f1(chung.criteria[i] == null ? null : chung.criteria[i]! / 10)} />)}
              <View style={[styles.totalRow, { borderTopColor: c.hairline }]}>
                <Txt v="label">Total</Txt>
                <Txt v="scoreXl" color="goldText" style={{ fontSize: 36, lineHeight: 38 }}>{f1(chung.total)}</Txt>
              </View>
              <SendButton compact state={sending ? 'sending' : 'ready'} label={sending ? undefined : 'Send score'} detail={sending ? null : f1(chung.total)} onPress={send} />
              <Button label="Back to scoring" variant="ghost" block disabled={sending} onPress={() => setSheet('closed')} />
            </ScrollView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Txt v="body" color="inkMuted">{k}</Txt>
      <Txt v="scoreMd">{v}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  who: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  tag: { height: 20, paddingHorizontal: 6, borderRadius: radius.sm, justifyContent: 'center' },
  body: { padding: space[4], gap: space[5] },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderBottomWidth: 1, paddingBottom: 6 },
  crit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  foot: { borderTopWidth: 1, paddingHorizontal: space[4], paddingTop: space[3], gap: 10 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, padding: space[4], gap: space[3] },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, paddingTop: space[2] },
  okm: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ids: { alignSelf: 'stretch', borderRadius: radius.sm, padding: space[3], gap: 2 },
});
