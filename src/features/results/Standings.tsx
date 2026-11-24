// Phases 5–7 · Score calculation and ranking, qualification and next round, final results.
import { useState } from 'react';
import { Alert, View } from 'react-native';
import type { Athlete, Bout, CategoryRound } from '@/core/types';
import { api, useScoring } from '@/data';
import { MODE_LABEL, STATUS } from '@/features/admin/RoundsTab';
import { cutLineTie, cutoffPodium, cutoffStandings, medalTie, pkPodium, type Podium, type Standing } from '@/sports/poomsae/ranking';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { ChipRow, KV, Notice } from '@/ui/console';
import { Button, Icon, Panel, RuleBadge, Txt } from '@/ui/primitives';

const f4 = (n: number | null | undefined) => (n == null ? '–.––––' : n.toFixed(4));

export function Standings({ wide, startRoundId }: { wide: boolean; startRoundId?: string }) {
  const s = useScoring();
  const start = s.setup.rounds.find((r) => r.id === startRoundId);
  const [cat, setCat] = useState(start?.categoryId ?? s.setup.categories[0].id);
  const rounds = s.setup.rounds.filter((r) => r.categoryId === cat).sort((a, b) => a.order - b.order);
  const firstActive = rounds.find((r) => r.status !== 'CONFIRMED') ?? rounds[rounds.length - 1];
  const [roundSel, setRoundSel] = useState<Record<string, string>>(start ? { [start.categoryId]: start.id } : {});
  const roundId = roundSel[cat] ?? firstActive?.id;
  const round = rounds.find((r) => r.id === roundId) ?? firstActive;
  const category = s.setup.categories.find((c) => c.id === cat)!;

  return (
    <View style={{ gap: space[3] }}>
      <ChipRow value={cat} onChange={setCat} options={s.setup.categories.map((x) => ({ value: x.id, label: x.name, hint: MODE_LABEL[x.mode] }))} />
      <ChipRow value={round.id} onChange={(v) => setRoundSel({ ...roundSel, [cat]: v })} options={rounds.map((r) => ({ value: r.id, label: r.name, hint: STATUS[r.status].label }))} />
      <RoundView key={round.id} round={round} rounds={rounds} categoryName={category.name} wide={wide} onOpenRound={(id) => setRoundSel({ ...roundSel, [cat]: id })} />
    </View>
  );
}

function RoundView({ round: r, rounds, categoryName, wide, onOpenRound }: { round: CategoryRound; rounds: CategoryRound[]; categoryName: string; wide: boolean; onOpenRound: (id: string) => void }) {
  const s = useScoring();
  const [msg, setMsg] = useState<{ text: string; tone: 'alert' | 'ok' } | null>(null);
  const next = rounds.find((x) => x.order === r.order + 1);
  const isFinal = r.advanceCount == null;
  const entries = s.results.entries[r.id] ?? [];
  const withdrawn = s.results.withdrawn.filter((w) => w.roundId === r.id).map((w) => w.entryId);
  const standings = r.format === 'CUTOFF' ? cutoffStandings(r, entries, s.results.scores, withdrawn) : [];
  const bouts = s.results.bouts.filter((b) => b.roundId === r.id).sort((a, b) => a.order - b.order);
  const tie = r.format === 'CUTOFF' ? (isFinal ? medalTie(standings) : cutLineTie(r, standings)) : null;
  const confirmed = r.status === 'CONFIRMED';
  const quals = s.results.qualifications.filter((q) => q.roundId === r.id);

  let podium: Podium[] = [];
  if (isFinal && confirmed) {
    if (r.format === 'CUTOFF') podium = cutoffPodium(standings);
    else {
      const prev = rounds.find((x) => x.order === r.order - 1);
      podium = pkPodium(bouts[0], s.results.bouts.filter((b) => b.roundId === prev?.id));
    }
  }

  const run = async (p: Promise<{ ok: boolean; error?: string }>, okText: string) => {
    const res = await p;
    setMsg(res.ok ? { text: okText, tone: 'ok' } : { text: res.error ?? 'Not saved', tone: 'alert' });
  };
  const confirm = () =>
    Alert.alert(isFinal ? 'Confirm final standings?' : `Confirm qualification for ${r.name}?`,
      isFinal ? 'Medals are awarded and the category is closed. This is recorded in the audit log.' : `The top ${r.advanceCount} ${r.format === 'PK' ? 'winners' : 'entries'} move to ${next?.name ?? 'the next round'}. This is recorded in the audit log.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => run(api.confirmQualification(r.id), isFinal ? 'Final standings confirmed.' : `Qualification confirmed. ${next?.name ?? 'Next round'} is ready.`) }]);

  const progress = r.format === 'PK'
    ? `${bouts.filter((b) => b.winner).length} of ${bouts.length} bouts decided`
    : `${standings.filter((x) => x.complete).length} of ${standings.filter((x) => !x.withdrawn).length} entries scored`;

  return (
    <View style={{ gap: space[3] }}>
      <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
          <View style={{ flexShrink: 1 }}>
            <Txt v="overline" color="inkMuted">{categoryName}</Txt>
            <Txt v="title">{r.name}</Txt>
          </View>
          <RuleBadge tone={STATUS[r.status].tone} label={STATUS[r.status].label} />
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', columnGap: space[5] }}>
          <View style={{ flex: 1 }}>
            <KV k="Format">{r.format === 'PK' ? 'PK bouts' : 'Cut-off'}</KV>
            <KV k={r.forms.length > 1 ? 'Forms' : 'Form'}>{r.forms.map((f) => f.name).join(' · ')}</KV>
          </View>
          <View style={{ flex: 1 }}>
            <KV k="Progress">{entries.length || bouts.length ? progress : 'No entries yet'}</KV>
            <KV k={isFinal ? 'Result' : 'Advance'}>{isFinal ? 'Final · medals' : `${r.advanceCount} to ${next?.name ?? 'next round'}`}</KV>
          </View>
        </View>
        {r.format === 'CUTOFF' ? <Txt v="caption" color="inkMuted">Rank = average of form scores. Tie-break (draft): higher presentation, then the chief referee decides.</Txt> : null}
      </Panel>

      {podium.length ? <PodiumView podium={podium} wide={wide} /> : null}

      {tie && !confirmed ? <TieResolver round={r} tied={tie} isFinal={isFinal} onDone={(t) => setMsg({ text: t, tone: 'ok' })} /> : null}

      {r.format === 'CUTOFF'
        ? (standings.length ? <StandingsTable round={r} standings={standings} quals={quals.map((q) => q.entryId).filter((e) => quals.find((q) => q.entryId === e)?.qualified)} confirmed={confirmed} wide={wide} /> : <EmptyRound round={r} />)
        : (bouts.length ? <BoutList bouts={bouts} wide={wide} /> : <EmptyRound round={r} />)}

      <Notice text={msg?.text ?? null} tone={msg?.tone} />

      {tie && !confirmed ? <Notice text={`A tie ${isFinal ? 'for a medal' : 'at the cut line'} must be settled first. The chief referee decides it here or on the game screen (choose the winner or order a rematch).`} /> : null}
      {r.status === 'SCORED' ? (
        <Button label={isFinal ? 'Confirm final standings' : `Confirm qualifiers · top ${r.advanceCount}`} icon="check" size="lg" block disabled={!!tie} onPress={confirm} />
      ) : null}
      {r.status === 'READY' ? (
        <Button label={`Send ${r.name} to ${s.ring.name} queue`} icon="send" size="lg" block onPress={() => run(api.scheduleRound(r.id), `${r.name} added to the ${s.ring.name} queue.`)} />
      ) : null}
      {confirmed && next ? (
        <Button label={`Open ${next.name}`} icon="chevron" variant="secondary" block onPress={() => onOpenRound(next.id)} />
      ) : null}
    </View>
  );
}

function EmptyRound({ round }: { round: CategoryRound }) {
  return <Notice tone="info" text={round.order === 1 ? 'Entries come from TMS registration.' : 'Entries arrive when the chief referee confirms the previous round.'} />;
}

function StandingsTable({ round, standings, quals, confirmed, wide }: { round: CategoryRound; standings: Standing[]; quals: string[]; confirmed: boolean; wide: boolean }) {
  const { c } = useTheme();
  const s = useScoring();
  // Why an entry left the round: a walkover recorded on any of its games.
  const outReason = (entryId: string) => s.queue.find((q) => q.roundId === round.id && q.chung.entryId === entryId && q.walkover)?.walkover?.reason ?? null;
  const n = round.advanceCount;
  const ranked = standings.filter((x) => x.complete);
  const lineAfter = n != null && ranked.length > n ? ranked[n - 1].entry.entryId : null;
  const showForms = wide || round.forms.length === 1;

  return (
    <Panel style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View style={[st.tr, { borderBottomColor: c.hairline, minHeight: 36 }]}>
        <Txt v="overline" color="inkMuted" style={st.rank}>Rank</Txt>
        <Txt v="overline" color="inkMuted" style={{ flex: 1 }}>Athlete</Txt>
        {showForms ? round.forms.map((f) => <Txt key={f.formNo} v="overline" color="inkMuted" style={st.num}>F{f.formNo}</Txt>) : null}
        <Txt v="overline" color="inkMuted" style={st.num}>{round.forms.length > 1 ? 'Average' : 'Score'}</Txt>
        <View style={st.tag} />
      </View>
      {standings.map((row) => {
        const q = confirmed ? quals.includes(row.entry.entryId) : n != null && row.complete && ranked.indexOf(row) < n && !row.tied;
        return (
          <View key={row.entry.entryId}>
            <View style={[st.tr, { borderBottomColor: c.hairline, backgroundColor: row.tied ? c.alertSoft : 'transparent' }]}>
              <View style={st.rank}>
                <Txt v="scoreMd" color={row.rank ? 'ink' : 'inkMuted'} style={{ fontSize: 20 }}>{row.rank ?? '–'}</Txt>
                {row.tied ? <Txt v="overline" color="alertText" style={{ fontSize: 9 }}>Tie</Txt> : null}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="label" numberOfLines={1} style={row.withdrawn && { textDecorationLine: 'line-through' }}>{row.entry.name}</Txt>
                <Txt v="caption" color="inkMuted" style={{ fontSize: 11 }}>{row.entry.nat} · {row.entry.entryId}</Txt>
              </View>
              {showForms ? row.forms.map((v, i) => <Txt key={i} v="mono" color={v == null ? 'inkMuted' : 'ink'} style={st.num}>{v == null ? '—' : v.toFixed(2)}</Txt>) : null}
              <Txt v="scoreMd" style={[st.num, { fontSize: 18 }]}>{row.average == null ? (row.withdrawn ? '' : `${row.forms.filter((x) => x != null).length}/${round.forms.length}`) : f4(row.average)}</Txt>
              <View style={st.tag}>
                {row.withdrawn ? <RuleBadge tone={outReason(row.entry.entryId) === 'Disqualified' ? 'pending' : 'unconfigured'} label={outReason(row.entry.entryId) === 'Disqualified' ? 'Disqualified' : outReason(row.entry.entryId) === 'Did not appear' ? 'No-show' : 'Withdrawn'} />
                  : !row.complete ? <RuleBadge tone="unconfigured" label="Not scored yet" />
                    : row.tied ? <RuleBadge tone="pending" label="Tie" />
                      : q ? <RuleBadge tone={confirmed ? 'released' : 'approved'} label={confirmed ? 'Qualified' : 'Q'} /> : null}
              </View>
            </View>
            {lineAfter === row.entry.entryId ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], paddingVertical: 6, backgroundColor: c.goldSoft }}>
                <View style={{ flex: 1, height: 2, backgroundColor: c.goldText }} />
                <Txt v="overline" color="goldText">Qualification line · top {n}</Txt>
                <View style={{ flex: 1, height: 2, backgroundColor: c.goldText }} />
              </View>
            ) : null}
          </View>
        );
      })}
    </Panel>
  );
}

function BoutList({ bouts, wide }: { bouts: Bout[]; wide: boolean }) {
  const { c } = useTheme();
  const s = useScoring();
  const [err, setErr] = useState<string | null>(null);
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: wide ? 'wrap' : 'nowrap', gap: space[3] }}>
      {bouts.map((b) => {
        const perf = s.queue.find((p) => p.id === b.performanceId);
        const walkover = !b.winner && perf?.status === 'WITHDRAWN';
        const side = (sd: 'chung' | 'hong', a: Athlete, fin: number | null) => {
          const won = b.winner === sd;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[2], borderRadius: radius.sm, backgroundColor: won ? (sd === 'chung' ? c.chungSoft : c.hongSoft) : 'transparent' }}>
              <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: sd === 'chung' ? c.chung : c.hong }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt v="label" numberOfLines={1}>{a.name}</Txt>
                <Txt v="caption" color="inkMuted" style={{ fontSize: 11 }}>{a.nat}</Txt>
              </View>
              <Txt v="scoreMd" style={{ fontSize: 18 }} color={won ? 'ink' : 'inkMuted'}>{fin == null ? '' : fin.toFixed(4)}</Txt>
              {won ? <Icon name="check" size={18} color={c.okText} /> : <View style={{ width: 18 }} />}
            </View>
          );
        };
        return (
          <Panel key={b.performanceId} style={{ flexBasis: wide ? '48%' : 'auto', flexGrow: 1, gap: space[2] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt v="overline" color="inkMuted">{b.matchNo === '—' ? `Bout ${b.order} · not scheduled` : `Match ${b.matchNo}`}</Txt>
              <Txt v="overline" color={b.winner ? 'okText' : walkover ? 'alertText' : 'inkMuted'}>{b.winner ? 'Decided' : walkover ? 'Withdrawn' : perf ? 'In queue' : 'Waiting'}</Txt>
            </View>
            {side('chung', b.chung, b.chungFinal)}
            {side('hong', b.hong, b.hongFinal)}
            {walkover ? (
              <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
                <Button label="Chung advances" variant="chung" onPress={async () => { const r = await api.decideBout(b.performanceId, 'chung'); setErr(r.ok ? null : r.error); }} style={{ flex: 1 }} />
                <Button label="Hong advances" variant="hong" onPress={async () => { const r = await api.decideBout(b.performanceId, 'hong'); setErr(r.ok ? null : r.error); }} style={{ flex: 1 }} />
              </View>
            ) : null}
          </Panel>
        );
      })}
      <Notice text={err} />
    </View>
  );
}

function TieResolver({ round, tied, isFinal, onDone }: { round: CategoryRound; tied: Standing[]; isFinal: boolean; onDone: (t: string) => void }) {
  const { c } = useTheme();
  const [order, setOrder] = useState<string[]>([]);
  const remaining = tied.filter((t) => !order.includes(t.entry.entryId));
  const name = (id: string) => tied.find((t) => t.entry.entryId === id)?.entry.name ?? id;
  async function pick(id: string) {
    const next = [...order, id];
    const left = tied.filter((t) => !next.includes(t.entry.entryId));
    if (left.length <= 1) {
      const full = [...next, ...left.map((t) => t.entry.entryId)];
      const r = await api.resolveTie(round.id, full);
      if (r.ok) onDone(`Order set: ${full.map(name).join(' › ')}`);
      setOrder([]);
    } else setOrder(next);
  }
  return (
    <Panel style={{ borderColor: c.alert, borderWidth: 1.5 }}>
      <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
        <Icon name="alert" size={20} color={c.alertText} />
        <Txt v="heading" color="alertText" style={{ flex: 1 }}>{isFinal ? 'Tie on a medal position' : 'Tie on the qualification line'}</Txt>
      </View>
      <Txt v="body" color="inkMuted">
        {tied.length} entries have the same average ({f4(tied[0].average)}) and the same presentation ({tied[0].presentation?.toFixed(2)}). The tie-break rule is pending approval, so the chief referee sets the order (e.g. after a rematch). Tap the entry that ranks higher.
      </Txt>
      {order.length ? <Txt v="caption">Placed: {order.map(name).join(' › ')}</Txt> : null}
      <View style={{ gap: space[2] }}>
        {remaining.map((t) => (
          <Button key={t.entry.entryId} variant="secondary" icon="chevron" label={`${t.entry.name} · ${t.entry.nat} ranks higher`} block onPress={() => pick(t.entry.entryId)} />
        ))}
      </View>
    </Panel>
  );
}

function PodiumView({ podium, wide }: { podium: Podium[]; wide: boolean }) {
  const { c } = useTheme();
  const tone = { gold: '#d4a017', silver: '#9aa3ad', bronze: '#b0703c' };
  const label = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Icon name="award" size={20} color={c.goldText} />
        <Txt v="overline" color="goldText">Final results</Txt>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[3] }}>
        {podium.map((p, i) => (
          <View key={`${p.medal}-${i}`} style={{ flex: wide ? 1 : undefined, flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.md, borderWidth: 1.5, borderColor: tone[p.medal], backgroundColor: c.surfaceRaised }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tone[p.medal], alignItems: 'center', justifyContent: 'center' }}>
              <Txt v="scoreMd" color="#ffffff" style={{ fontSize: 18 }}>{p.medal === 'gold' ? 1 : p.medal === 'silver' ? 2 : 3}</Txt>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="overline" color="inkMuted">{label[p.medal]}</Txt>
              <Txt v="label" numberOfLines={1}>{p.entry.name}</Txt>
              <Txt v="caption" color="inkMuted">{p.entry.nat}{p.score != null ? ` · ${f4(p.score)}` : ''}</Txt>
            </View>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const st = {
  tr: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space[2], paddingHorizontal: space[3], minHeight: 52, borderBottomWidth: 1 },
  rank: { width: 40 },
  num: { width: 72, textAlign: 'right' as const },
  tag: { width: 112, alignItems: 'flex-end' as const },
};
