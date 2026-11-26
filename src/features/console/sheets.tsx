// Pick-and-confirm sheets of the console. A sheet only collects a choice; the final action always
// goes through `ask`, which the console turns into an ActionSheet and `run(...)`.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useState } from 'react';
import type { ConsoleView, SeatTile } from '@/live/consoleView';
import { api } from '@/live';
import { space } from '@/theme/tokens';
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
});
