import { useFreeOrientation } from '@/hooks/useFreeOrientation';
import { Redirect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Side } from '@/core/types';
import { api, useScoring } from '@/data';
import { hhmmss, judgeStates } from '@/features/officials/helpers';
import { accountFor } from '@/features/session/session';
import { CutoffTiePanel, PenaltySheet } from '@/features/officials/GameActions';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { MatchBar } from '@/ui/match';
import { JudgeStatusGrid } from '@/ui/officials';
import { Button, Icon, Panel, RuleBadge, StatusPill, Txt, f1 } from '@/ui/primitives';
import { Notice } from '@/ui/console';

export default function RefereeScreen() {
  const s = useScoring();
  if (!accountFor(s, 'CHIEF')) return <Redirect href={{ pathname: '/sign-in', params: { next: 'referee' } }} />;
  return (
    <ThemeProvider name="daylight">
      <StatusBar style="dark" />
      <Referee />
    </ThemeProvider>
  );
}

function Referee() {
  useFreeOrientation();
  const router = useRouter();
  const { c } = useTheme();
  const s = useScoring();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [corr, setCorr] = useState(false);
  const [more, setMore] = useState(false);
  const cur = s.current;
  const sides: Side[] = cur?.format === 'PK' ? ['chung', 'hong'] : ['chung'];
  const complete = !!s.result;
  const r = s.result;
  const subs = [...s.submissions].sort((a, b) => a.judgeNo - b.judgeNo);

  async function release() {
    setBusy(true);
    const res = await api.releaseResult();
    setBusy(false);
    setMsg(res.ok ? null : res.error);
  }

  const sideLabel = (sd: Side) => (cur?.format === 'PK' ? (sd === 'chung' ? 'Chung' : 'Hong') : 'Total');
  const accLabel = s.rules.discipline === 'FREESTYLE' ? 'Tech' : 'Acc';
  // Cut-off is one athlete in blue; red only appears in PK.
  const tone = (sd: Side) => (sd === 'hong' ? 'hongText' : 'chungText');
  const excludedFor = (sd: Side, judgeNo: number) => (r?.sides[sd]?.excludedHigh === judgeNo ? 'high' : r?.sides[sd]?.excludedLow === judgeNo ? 'low' : null);

  const table = (
    <Panel style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View style={[styles.tr, { borderBottomColor: c.hairline }]}>
        <Txt v="overline" color="inkMuted" style={styles.cJ}>Judge</Txt>
        {sides.map((sd) => (
          <View key={sd} style={styles.grp}>
            <Txt v="overline" color={tone(sd)} style={styles.cN}>{accLabel}</Txt>
            <Txt v="overline" color={tone(sd)} style={styles.cN}>Pres</Txt>
            <Txt v="overline" color={tone(sd)} numberOfLines={1} adjustsFontSizeToFit style={styles.cN}>{sideLabel(sd)}</Txt>
          </View>
        ))}
        {wide ? <Txt v="overline" color="inkMuted" style={styles.cT}>Received</Txt> : null}
      </View>
      {complete ? subs.map((sub) => (
        <View key={sub.judgeNo} style={[styles.tr, { borderBottomColor: c.hairline }]}>
          <Txt v="scoreMd" style={styles.cJ}>J{sub.judgeNo}</Txt>
          {sides.map((sd) => {
            const x = sub.sides[sd];
            const ex = excludedFor(sd, sub.judgeNo);
            return (
              <View key={sd} style={styles.grp}>
                <Txt v="scoreMd" style={styles.cN}>{f1(x?.accuracy)}</Txt>
                <Txt v="scoreMd" style={styles.cN}>{f1(x?.presentation)}</Txt>
                <View style={styles.cN}>
                  <Txt v="scoreMd" color={ex ? 'inkMuted' : 'ink'} style={[{ textAlign: 'right', fontFamily: 'SairaCondensed_700Bold' }, ex && { textDecorationLine: 'line-through' }]}>{f1(x?.total)}</Txt>
                  {ex ? <Txt v="overline" color="inkMuted" style={{ fontSize: 9, textAlign: 'right' }}>{ex}</Txt> : null}
                </View>
              </View>
            );
          })}
          {wide ? <Txt v="mono" color="inkMuted" style={styles.cT}>{hhmmss(sub.receivedAt)}</Txt> : null}
        </View>
      )) : (
        <View style={{ padding: space[5], alignItems: 'center', gap: space[2] }}>
          <Icon name="lock" size={24} color={c.inkMuted} />
          <Txt v="body" color="inkMuted" style={{ textAlign: 'center' }}>Each judge’s figures appear here once every judge has sent. {s.submissions.length} of {s.judges.length} received.</Txt>
        </View>
      )}
    </Panel>
  );

  const resultCard = (
    <Panel>
      <View style={styles.ph}>
        <Txt v="overline" color="inkMuted">Provisional result</Txt>
        <RuleBadge tone={r?.released ? 'released' : 'pending'} label={r?.released ? 'Released' : 'Not released'} />
      </View>
      {cur ? sides.map((sd) => (
        <View key={sd} style={[styles.res, { backgroundColor: sd === 'hong' ? c.hongSoft : c.chungSoft }]}>
          <Txt v="overline" color={tone(sd)} numberOfLines={1} style={{ flexShrink: 1, marginRight: space[2] }}>
            {sd === 'hong' ? `Hong · ${cur.hong?.nat}` : cur.format === 'PK' ? `Chung · ${cur.chung.nat}` : `${cur.chung.entryId} · ${cur.chung.name}`}
          </Txt>
          <Txt v="scoreXl" style={{ fontSize: 34, lineHeight: 36 }}>{r?.sides[sd] ? r.sides[sd]!.final.toFixed(4) : '–.––––'}</Txt>
        </View>
      )) : <Txt v="body" color="inkMuted">No performance on the mat.</Txt>}
      {r?.winner && r.winner !== 'TIE' && r.sides.chung && r.sides.hong ? (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="flag" size={18} color={c.ink} />
          <Txt v="label"><Txt v="label" color={r.winner === 'chung' ? 'chungText' : 'hongText'}>{r.winner === 'chung' ? 'Chung' : 'Hong'}</Txt> leads by {Math.abs(r.sides.chung.final - r.sides.hong.final).toFixed(4)}</Txt>
        </View>
      ) : null}
      {msg ? <Txt v="caption" color="alertText">{msg}</Txt> : null}
      {cur?.format === 'PK' && cur.hong && r?.winner === 'TIE' && !r.released ? (
        <View style={{ gap: space[2] }}>
          <Txt v="label" color="alertText">Tie: choose the winner (chief referee only)</Txt>
          {(['chung', 'hong'] as Side[]).map((sd) => (
            <Button key={sd} label={`Declare ${cur[sd]!.name}`} icon="flag" size="lg" block variant={sd === 'chung' ? 'primary' : 'secondary'} disabled={busy}
              onPress={async () => { setBusy(true); const x = await api.declareWinner(sd, 'CHIEF'); setBusy(false); setMsg(x.ok ? null : x.error); }} />
          ))}
        </View>
      ) : (
        <Button label={r?.released ? `Released ${hhmmss(r.releasedAt)}` : busy ? 'Releasing…' : 'Release to display'} icon={r?.released ? 'check' : 'send'} size="lg" block
          disabled={!complete || !!r?.released || busy} onPress={release} />
      )}
      <Button label="More actions · penalty" icon="menu" variant="secondary" block disabled={!cur || !['OPEN', 'COMPLETE', 'WITH_RIC'].includes(cur.status)} onPress={() => setMore(true)} />
      <Button label="Request correction" icon="pencil" variant="danger" block disabled={!complete || !!r?.released}
        onPress={() => setCorr(true)} />
    </Panel>
  );

  const curLabel = cur ? `Match ${cur.matchNo}${cur.format === 'CUTOFF' ? ` · Form ${cur.formNo}` : ''}` : null;
  const log = s.audit.filter((a) => a.target === curLabel).slice(0, 12);
  const audit = (
    <Panel>
      <View style={styles.ph}>
        <Txt v="overline" color="inkMuted">Audit · this performance</Txt>
        <Button label="Results" icon="list" variant="ghost" onPress={() => router.push('/results')} style={{ minHeight: 36, paddingHorizontal: 8 }} />
      </View>
      {log.map((a) => (
        <Txt key={a.id} v="mono" color="inkMuted" numberOfLines={2}>{hhmmss(a.at)}  <Txt v="mono">{a.actor.replace('Judge ', 'J').replace('Chief referee', 'RIC').replace('Ring operator', 'OPR')} {a.action}</Txt>{a.detail ? `  ${a.detail}` : ''}</Txt>
      ))}
      {log.length === 0 ? <Txt v="caption" color="inkMuted">Nothing recorded yet.</Txt> : null}
    </Panel>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }} edges={['top', 'left', 'right', 'bottom']}>
      <MatchBar onHome={() => router.replace('/')} matchNo={cur?.matchNo} ring={s.ring.name} category={cur?.category ?? 'Chief referee'} round={cur?.round} roleLabel="Chief referee" connection="online" compact={!wide} />
      <ScrollView contentContainerStyle={[styles.body, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={{ flex: 1, gap: space[3], minWidth: 0 }}>
          <View style={styles.ph}>
            <Txt v="overline" color="inkMuted">Submissions <Txt v="scoreMd">{s.submissions.length} / {s.judges.length}</Txt></Txt>
            {complete ? <StatusPill status="sent" label="Panel complete" /> : <StatusPill status="waiting" label={cur?.status === 'OPEN' ? 'Scoring open' : 'Waiting'} />}
          </View>
          <JudgeStatusGrid judges={judgeStates(s)} chipWidth={wide ? 80 : 60} />
          {cur?.stopReason ? <Notice text={`Stopped by the operator: ${cur.stopReason}. ${s.submissions.length} of ${s.judges.length} judges sent before the stop.${s.submissions.length ? '' : ' No scores to release.'}`} /> : null}
          {s.correction ? <Notice tone="info" text={`Correction open · Judge ${s.correction.judgeNo} is re-scoring (${s.correction.reason}). The result is recalculated when the new revision arrives.`} /> : null}
          {s.rules.trimMode !== 'APPROVED' ? (
            <View style={[styles.banner, { backgroundColor: c.alertSoft, borderColor: c.alert }]}>
              <Icon name="alert" size={18} color={c.alertText} />
              <Txt v="caption" color="alertText" style={{ flex: 1 }}>Trim mode pending approval. Preview drops 1 high + 1 low judge total; not an official method yet.</Txt>
            </View>
          ) : null}
          {table}
          <CutoffTiePanel s={s} />
        </View>
        <View style={{ width: wide ? 320 : undefined, gap: space[3] }}>
          {resultCard}
          {audit}
        </View>
      </ScrollView>
      {more ? <PenaltySheet by="CHIEF" onClose={() => setMore(false)} /> : null}
      <CorrectionSheet visible={corr} judges={subs.map((x) => x.judgeNo)} onClose={() => setCorr(false)} onDone={(t) => { setCorr(false); setMsg(t); }} />
    </SafeAreaView>
  );
}

function CorrectionSheet({ visible, judges, onClose, onDone }: { visible: boolean; judges: number[]; onClose: () => void; onDone: (msg: string | null) => void }) {
  const { c } = useTheme();
  const [judge, setJudge] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    if (judge == null) return setErr('Choose the judge to reopen');
    setBusy(true);
    const r = await api.requestCorrection(judge, reason);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setJudge(null); setReason(''); setErr(null);
    onDone(null);
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
      <View style={[styles.sheet, { position: 'relative', backgroundColor: c.surface }]}>
        <View style={styles.ph}>
          <Txt v="heading">Request correction</Txt>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}><Icon name="close" size={22} color={c.inkMuted} /></Pressable>
        </View>
        <Txt v="body" color="inkMuted">Reopens one judge. Their current submission is kept in the history; they send a new revision and the result is recalculated.</Txt>
        <Txt v="overline" color="inkMuted">Judge</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {judges.map((j) => (
            <Pressable key={j} onPress={() => setJudge(j)} accessibilityRole="radio" accessibilityState={{ checked: judge === j }}
              style={{ width: 56, height: 48, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', borderColor: judge === j ? c.ink : c.hairline, backgroundColor: judge === j ? c.ink : c.surfaceRaised }}>
              <Txt v="scoreMd" color={judge === j ? c.ground : 'ink'} style={{ fontSize: 20 }}>J{j}</Txt>
            </Pressable>
          ))}
        </View>
        <Txt v="overline" color="inkMuted">Reason (required)</Txt>
        <TextInput value={reason} onChangeText={setReason} placeholder="e.g. Criterion entered on the wrong athlete" placeholderTextColor={c.inkMuted} multiline
          style={{ minHeight: 72, borderWidth: 1.5, borderColor: c.controlBorder, borderRadius: radius.md, padding: space[3], color: c.ink, fontFamily: 'IBMPlexSans_400Regular', fontSize: 15, textAlignVertical: 'top' }} />
        <Notice text={err} />
        <Button label={busy ? 'Reopening…' : 'Reopen judge'} icon="pencil" variant="danger" size="lg" block disabled={busy || judge == null || !reason.trim()} onPress={send} />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[4], gap: space[4] },
  ph: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: space[3], borderRadius: radius.sm, borderWidth: 1 },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], minHeight: 46, borderBottomWidth: 1, gap: space[2] },
  grp: { flex: 1, flexDirection: 'row', gap: 4 },
  cJ: { width: 52 },
  cN: { flex: 1, textAlign: 'right' },
  cT: { width: 70, textAlign: 'right' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: space[3], padding: space[5], paddingBottom: space[6], borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  res: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space[3], borderRadius: radius.sm },
});
