// Pick-and-confirm sheets of the console. A sheet only collects a choice; the final action always
// goes through `ask`, which the console turns into an ActionSheet and `run(...)`.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import type { ActionResult, DisplayLink, GameForms, OptionsPerformance } from '@/api/types';
import type { ConsoleView, SeatTile } from '@/live/consoleView';
import { api, baseUrl, texts } from '@/live';
import { space } from '@/theme/tokens';
import { ChipRow } from '@/ui/console';
import { Button, Txt } from '@/ui/primitives';
import { CenterSheet, ChoiceRow } from '@/ui/sheet';
import type { RunFn } from './useConsoleLive';

/** A confirmation the console shows through ActionSheet. */
export interface Ask {
  title: string;
  text?: string;
  /** Label of the reason box; leave out for no reason box. */
  reason?: string;
  reasonRequired?: boolean;
  okLabel?: string;
  danger?: boolean;
  go: (reason: string) => void;
}
export type AskFn = (a: Ask) => void;
export interface SheetCtx { v: ConsoleView; run: RunFn; ask: AskFn; onClose: () => void }

const STATUS_TEXT: Record<SeatTile['status'], string> = { EMPTY: 'No device', WAITING: 'Waiting', DRAFT: 'Scoring', SENT: 'Sent', OFFLINE: 'Offline' };

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function SeatSheet({ v, run, ask, onClose, seat }: SheetCtx & { seat: SeatTile }) {
  const gameId = v.gameId;
  const canEnter = !!gameId && v.stage === 'SCORING_OPEN' && seat.status !== 'SENT';
  return (
    <CenterSheet title={`Referee J${seat.seat}`} subtitle={`${STATUS_TEXT[seat.status]}${seat.device ? ` · ${seat.device}` : ''}`} onClose={onClose}>
      {seat.unsent ? <Txt v="caption" color="inkMuted">{seat.unsent} unsent on the device</Txt> : null}
      {canEnter ? (
        <Button
          label={`Enter maximum for J${seat.seat}`}
          variant="secondary"
          block
          onPress={() => gameId && ask({
            title: `Enter maximum for J${seat.seat}?`,
            text: `The maximum score is sent for referee J${seat.seat} on form ${v.formNo}.`,
            reason: 'Reason (device failure…)',
            reasonRequired: true,
            okLabel: 'Enter maximum',
            go: (reason) => void run('Enter maximum', () => api.enterForSeat(gameId, v.formNo, seat.seat, reason), `Maximum entered for J${seat.seat}`),
          })}
        />
      ) : null}
      {seat.status !== 'EMPTY' ? (
        <Button
          label="Free this seat"
          variant="danger"
          block
          onPress={() => ask({
            title: `Free seat J${seat.seat}?`,
            text: 'The device is signed out of this seat and the seat can be taken again.',
            reason: 'Reason (optional)',
            okLabel: 'Free seat',
            danger: true,
            go: (reason) => void run('Free seat', () => api.releaseSeat({ ring: v.ring, seat: seat.seat, reason }), `Seat J${seat.seat} freed`),
          })}
        />
      ) : null}
      {!canEnter && seat.status === 'EMPTY' ? <Txt v="body" color="inkMuted">No actions for this seat.</Txt> : null}
    </CenterSheet>
  );
}

type WalkoverKind = 'NO_SHOW' | 'WITHDRAWN' | 'DISQUALIFIED';
const KINDS: { value: WalkoverKind; label: string; detail: string }[] = [
  { value: 'NO_SHOW', label: 'No-show', detail: 'The athlete did not appear' },
  { value: 'WITHDRAWN', label: 'Withdrawn', detail: 'The athlete withdrew' },
  { value: 'DISQUALIFIED', label: 'Disqualified', detail: 'The athlete is disqualified' },
];

/** PK walkover: which athlete is absent and why. */
export function WalkoverSheet({ v, run, ask, onClose }: SheetCtx) {
  const [absent, setAbsent] = useState<'BLUE' | 'RED' | null>(null);
  const [kind, setKind] = useState<WalkoverKind | null>(null);
  const gameId = v.gameId;
  const who = (corner: 'BLUE' | 'RED') => v.athletes.find((a) => a.corner === corner)?.name ?? corner;
  const kindLabel = KINDS.find((k) => k.value === kind)?.label ?? '';
  return (
    <CenterSheet title="Walkover" subtitle="Choose the absent athlete" onClose={onClose}>
      {(['BLUE', 'RED'] as const).map((c) => (
        <ChoiceRow key={c} label={`${c === 'BLUE' ? 'Blue' : 'Red'} · ${who(c)}`} on={absent === c} tone={c === 'BLUE' ? 'chung' : 'hong'} onPress={() => setAbsent(c)} />
      ))}
      {KINDS.map((k) => <ChoiceRow key={k.value} label={k.label} detail={k.detail} on={kind === k.value} onPress={() => setKind(k.value)} />)}
      <Button
        label="Continue"
        block
        disabled={!absent || !kind || !gameId}
        onPress={() => absent && kind && gameId && ask({
          title: `${kindLabel}: ${who(absent)}?`,
          text: `${who(absent === 'BLUE' ? 'RED' : 'BLUE')} wins by walkover.`,
          reason: 'Reason',
          reasonRequired: true,
          okLabel: 'Confirm walkover',
          danger: true,
          go: (reason) => void run('Walkover', () => api.walkover(gameId, absent, kind, reason), 'Walkover recorded'),
        })}
      />
    </CenterSheet>
  );
}

/** Cut-off game on the mat: the athlete did not appear, or withdrew. */
export function NoShowSheet({ v, run, ask, onClose }: SheetCtx) {
  const gameId = v.gameId;
  if (!gameId) return null;
  const pick = (title: string, text: string, label: string, fn: (reason: string) => Promise<unknown>, done: string) =>
    ask({ title, text, reason: 'Reason', reasonRequired: true, okLabel: label, danger: true, go: (reason) => void run(label, () => fn(reason), done) });
  return (
    <CenterSheet title="No-show / withdraw" onClose={onClose}>
      <Button label="Did not appear" variant="secondary" block onPress={() => pick('Mark as did not appear?', 'The athlete is recorded as a no-show.', 'No-show', (r) => api.noShow(gameId, r), 'No-show recorded')} />
      <Button label="Withdrew" variant="secondary" block onPress={() => pick('Mark as withdrawn?', 'The athlete is recorded as withdrawn.', 'Withdrawn', (r) => api.withdraw(gameId, r), 'Withdrawal recorded')} />
    </CenterSheet>
  );
}

/** Chief: choose the winner of a tie, or order a rematch. */
export function TieSheet({ v, run, ask, onClose, mode }: SheetCtx & { mode: 'WINNER' | 'REMATCH' }) {
  const [entryId, setEntryId] = useState<number | null>(null);
  const [formNo, setFormNo] = useState<number | null>(null);
  const gameId = v.gameId;
  const tie = v.tie;
  if (!gameId || !tie) return null;
  const athletes = tie.athletes ?? [];
  const forms = tie.forms ?? [];
  const chosen = athletes.find((a) => a.entryId === entryId);
  return (
    <CenterSheet title={mode === 'WINNER' ? 'Choose the winner' : 'Order a rematch'} onClose={onClose}>
      {mode === 'WINNER' ? (
        <>
          {athletes.map((a) => <ChoiceRow key={a.entryId} label={a.name} detail={[a.team, a.total ? `Total ${a.total}` : null].filter(Boolean).join(' · ')} on={entryId === a.entryId} onPress={() => setEntryId(a.entryId)} />)}
          <Button
            label="Continue"
            block
            disabled={entryId == null}
            onPress={() => entryId != null && ask({
              title: `Winner: ${chosen?.name ?? ''}?`,
              text: 'The chief referee decides the tie in favour of this athlete.',
              reason: 'Reason',
              reasonRequired: true,
              okLabel: 'Confirm winner',
              go: (reason) => void run('Tie', () => api.tie(gameId, { choice: 'WINNER', winnerEntryId: entryId }, reason), 'Tie decided'),
            })}
          />
        </>
      ) : (
        <>
          {forms.length ? <Txt v="caption" color="inkMuted">Form for the rematch</Txt> : <Txt v="body" color="inkMuted">No form is available for a rematch.</Txt>}
          {forms.map((f) => <ChoiceRow key={f.formNo} label={f.name ? `${f.name} · F${f.formNo}` : `Form ${f.formNo}`} on={formNo === f.formNo} onPress={() => setFormNo(f.formNo)} />)}
          <Button
            label="Continue"
            block
            disabled={formNo == null}
            onPress={() => formNo != null && ask({
              title: 'Order a rematch?',
              text: `The tied athletes perform form ${formNo} again.`,
              reason: 'Reason',
              reasonRequired: true,
              okLabel: 'Order rematch',
              go: (reason) => void run('Rematch', () => api.tie(gameId, { choice: 'REMATCH', formNo }, reason), 'Rematch ordered'),
            })}
          />
        </>
      )}
    </CenterSheet>
  );
}

/** Loads once when the sheet opens; shows the error instead of the content when it fails. */
function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((d) => { if (alive) setData(d); }, (e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, error };
}

function Loading({ error }: { error: string | null }) {
  return error ? <Txt v="body" color="alertText">{error}</Txt> : <Txt v="body" color="inkMuted">Loading…</Txt>;
}

const BAD = ['DISQUALIFIED', 'WITHDRAWN', 'NO_SHOW'];
const perfName = (p: OptionsPerformance) => `${p.name} · Form ${p.formNo}${p.attempt > 1 ? ` · attempt ${p.attempt}` : ''}`;

/** Penalties, restart, re-perform, disqualify and reinstate (web `moreModal`). */
export function MoreSheet({ v, run, ask, onClose }: SheetCtx) {
  const gameId = v.gameId;
  const chief = v.role === 'CHIEF';
  const { data: o, error } = useLoad(() => api.options(gameId ?? ''));
  const [perfId, setPerfId] = useState<number | null>(null);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [pick, setPick] = useState<'dq' | 'reinstate' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!gameId) return null;
  if (!o) return <CenterSheet title="More actions" onClose={onClose}><Loading error={error} /></CenterSheet>;

  const pk = o.kind === 'PK';
  const live = o.performances.filter((p) => !BAD.includes(p.status));
  const dq = o.performances.filter((p) => p.status === 'DISQUALIFIED');
  const perf = live.find((p) => p.performanceId === perfId) ?? null;
  const types = perf ? o.penaltyTypes[String(perf.ruleSetId)] ?? [] : [];
  const type = types.find((t) => t.code === typeCode) ?? null;
  const pens = o.performances.flatMap((p) => p.penalties.map((x) => ({ p, x })));
  const formNo = o.formNo ?? live[0]?.formNo ?? v.formNo;
  const rule = live[0] ? o.rules[String(live[0].ruleSetId)] ?? null : null;
  const used = live.reduce((m, p) => Math.max(m, p.restartsUsed), 0);

  if (pick) {
    const list = pick === 'dq' ? live : dq;
    const seen = new Set<number>();
    const ents = list.filter((p) => !seen.has(p.entryId) && !!seen.add(p.entryId));
    const choose = (entryId: number | null, name: string) => {
      const dqing = pick === 'dq';
      ask({
        title: `${dqing ? 'Disqualify' : 'Reinstate'} ${name}?`,
        text: dqing ? 'The athlete is disqualified from this game.' : 'The athlete is put back in the game.',
        reason: 'Reason',
        reasonRequired: true,
        okLabel: dqing ? 'Disqualify' : 'Reinstate',
        danger: dqing,
        go: (reason) => void run(dqing ? 'Disqualify' : 'Reinstate', () => (dqing ? api.disqualify(gameId, entryId, reason) : api.reinstate(gameId, entryId, reason)), dqing ? 'Athlete disqualified' : 'Athlete reinstated'),
      });
    };
    return (
      <CenterSheet title={pick === 'dq' ? 'Disqualify whom?' : 'Reinstate whom?'} onClose={onClose}>
        {ents.map((p) => <Button key={p.entryId} label={p.name} variant="secondary" block onPress={() => choose(p.entryId, p.name)} />)}
        {ents.length > 1 ? <Button label="Everybody" variant="secondary" block onPress={() => choose(null, 'everybody')} /> : null}
        <Button label="Back" variant="ghost" block onPress={() => setPick(null)} />
      </CenterSheet>
    );
  }

  const applyPenalty = () => {
    if (!perf || !type) return;
    ask({
      title: `${type.label} −${type.value}`,
      text: perfName(perf),
      reason: 'Reason',
      reasonRequired: type.requireReason,
      okLabel: 'Apply penalty',
      go: (reason) => void run('Penalty', () => api.penalty(gameId, perf.performanceId, type.code, reason), 'Penalty applied'),
    });
  };
  const restart = () => {
    if (rule && !rule.restartAllowed) { setMsg('A restart is not allowed in this game.'); return; }
    const info = rule ? ` Restarts used ${used}/${rule.maxRestarts ?? '∞'}, penalty ${rule.restartPenalty ?? '0'}.` : '';
    ask({
      title: `Restart form ${formNo}?`,
      text: `The form starts again.${info}`,
      reason: 'Reason',
      reasonRequired: true,
      okLabel: 'Restart',
      danger: true,
      go: (reason) => void run('Restart', () => api.restart(gameId, 'RESTART', reason), (r) => ((r as ActionResult | undefined)?.outcome === 'DISQUALIFIED' ? 'Restart limit reached: disqualified' : 'Restarted')),
    });
  };
  const reperform = () => ask({
    title: `Re-perform form ${formNo}?`,
    text: 'The athlete performs the form again, without a restart penalty.',
    reason: 'Reason',
    reasonRequired: true,
    okLabel: 'Re-perform',
    danger: true,
    go: (reason) => void run('Re-perform', () => api.restart(gameId, 'REPERFORM', reason), 'Re-perform ordered'),
  });

  return (
    <CenterSheet title="More actions" onClose={onClose}>
      <Txt v="overline" color="inkMuted">Penalty</Txt>
      {live.length ? (
        <>
          <Txt v="caption" color="inkMuted">Athlete</Txt>
          {live.map((p) => <ChoiceRow key={p.performanceId} label={perfName(p)} on={perfId === p.performanceId} onPress={() => { setPerfId(p.performanceId); setTypeCode(null); }} />)}
          {perf ? (
            <>
              <Txt v="caption" color="inkMuted">Type</Txt>
              {types.length ? types.map((t) => {
                const no = !chief && t.appliedBy === 'CHIEF';
                return <ChoiceRow key={t.code} label={`${t.label} −${t.value}${no ? ' (chief only)' : ''}`} on={typeCode === t.code} disabled={no} onPress={() => setTypeCode(t.code)} />;
              }) : <Txt v="body" color="inkMuted">No penalty types for this athlete.</Txt>}
            </>
          ) : null}
          <Button label="Apply penalty" block disabled={!perf || !type} onPress={applyPenalty} />
        </>
      ) : <Txt v="body" color="inkMuted">No athlete can take a penalty now.</Txt>}

      {pens.length ? (
        <>
          <Txt v="overline" color="inkMuted">Current penalties</Txt>
          {pens.map(({ p, x }) => (
            <Row key={x.penaltyId}>
              <Txt v="body" style={{ flex: 1, minWidth: 200 }}>{`${p.name} · Form ${p.formNo} · ${x.label} −${x.value}${x.reason ? ` (${x.reason})` : ''}`}</Txt>
              {chief ? (
                <Button label="Remove" variant="danger" onPress={() => ask({
                  title: 'Remove this penalty?',
                  text: `${p.name} · ${x.label} −${x.value}`,
                  reason: 'Reason',
                  reasonRequired: true,
                  okLabel: 'Remove',
                  danger: true,
                  go: (reason) => void run('Remove penalty', () => api.voidPenalty(x.penaltyId, reason), 'Penalty removed'),
                })} />
              ) : null}
            </Row>
          ))}
        </>
      ) : null}

      {chief ? (
        <>
          <Txt v="overline" color="inkMuted">Restart and disqualification</Txt>
          {msg ? <Txt v="body" color="alertText">{msg}</Txt> : null}
          <Row>
            <Button label="Restart" variant="secondary" onPress={restart} />
            <Button label="Re-perform" variant="secondary" onPress={reperform} />
            {!pk ? <Button label="Disqualify" variant="danger" disabled={!live.length} onPress={() => setPick('dq')} /> : null}
            {!pk && dq.length ? <Button label="Reinstate" variant="secondary" onPress={() => setPick('reinstate')} /> : null}
          </Row>
          {pk ? <Txt v="caption" color="inkMuted">In a PK game use Walkover with Disqualified.</Txt> : null}
        </>
      ) : null}
    </CenterSheet>
  );
}

/** PK: choose the forms of this game (web `formsModal`). */
export function FormsSheet({ v, run, ask, onClose }: SheetCtx) {
  const gameId = v.gameId;
  const { data: o, error } = useLoad(() => api.forms(gameId ?? ''));
  const [sel, setSel] = useState<number[] | null>(null);
  if (!gameId) return null;
  if (!o) return <CenterSheet title="Forms of this game" onClose={onClose}><Loading error={error} /></CenterSheet>;
  return <FormsBody o={o} gameId={gameId} run={run} ask={ask} onClose={onClose} sel={sel} setSel={setSel} />;
}

function FormsBody({ o, gameId, run, ask, onClose, sel, setSel }: { o: GameForms; gameId: string; run: SheetCtx['run']; ask: AskFn; onClose: () => void; sel: number[] | null; setSel: (s: number[]) => void }) {
  const initial = o.forms.map((f) => o.available.find((a) => a.name === f.name)?.formId ?? 0);
  const ids = sel ?? (initial.length ? initial : [0]);
  const opts = o.available.map((a) => ({ value: String(a.formId), label: a.name }));
  const set = (i: number, id: number) => setSel(ids.map((x, j) => (j === i ? id : x)));
  return (
    <CenterSheet title="Forms of this game" subtitle={o.locked ? 'The forms are locked: scoring has started.' : 'One form per round of this game.'} onClose={onClose}>
      {ids.map((id, i) => (
        <View key={i} style={{ gap: 4 }}>
          <Txt v="label">Form {i + 1}</Txt>
          {o.locked ? <Txt v="body" color="inkMuted">{o.available.find((a) => a.formId === id)?.name ?? o.forms[i]?.name ?? '–'}</Txt>
            : <ChipRow value={String(id)} options={opts} onChange={(x) => set(i, Number(x))} />}
        </View>
      ))}
      {!o.locked ? (
        <>
          <Row>
            <Button label="Add a form" variant="secondary" disabled={ids.length >= 10} onPress={() => setSel([...ids, 0])} />
            <Button label="Remove last" variant="secondary" disabled={ids.length <= 1} onPress={() => setSel(ids.slice(0, -1))} />
          </Row>
          <Button
            label="Save forms"
            block
            disabled={ids.some((x) => !x)}
            onPress={() => ask({
              title: 'Save the forms of this game?',
              reason: 'Reason (optional)',
              okLabel: 'Save',
              go: (reason) => void run('Forms', () => api.setForms(gameId, ids, reason), 'Forms saved'),
            })}
          />
        </>
      ) : null}
    </CenterSheet>
  );
}

const TV_MODES: { value: string; label: string }[] = [
  { value: '', label: 'Follow the operator' },
  { value: 'callup', label: 'Call-up' },
  { value: 'clock', label: 'Clock' },
  { value: 'result', label: 'Result' },
];

/** The new TV address, with an optional fixed view. No clipboard module is installed, so the text is selectable. */
export function TvLinkSheet({ link, onClose }: { link: DisplayLink; onClose: () => void }) {
  const [mode, setMode] = useState('');
  const key = link.displayKey ?? link.key ?? '';
  const url = `${baseUrl().replace(/\/api\/v1\/?$/, '')}/display/${key}?lang=${texts.lang()}${mode ? `&mode=${mode}` : ''}`;
  return (
    <CenterSheet title={`TV link · Ring ${link.ring}`} subtitle="Open this address in the TV browser." onClose={onClose}>
      <Txt v="caption" color="inkMuted">Fixed view</Txt>
      <ChipRow value={mode} options={TV_MODES} onChange={setMode} />
      <Txt v="body" selectable style={{ fontSize: 14 }}>{url}</Txt>
      <Txt v="caption" color="inkMuted">Press and hold the address to select and copy it. The old link no longer works.</Txt>
      <Button label="Close" variant="secondary" block onPress={onClose} />
    </CenterSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
});
