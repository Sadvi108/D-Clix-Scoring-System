// Pick-and-confirm sheets of the console. A sheet only collects a choice; the final action always
// goes through `ask`, which the console turns into an ActionSheet and `run(...)`.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ConsoleView, SeatTile } from '@/live/consoleView';
import { api } from '@/live';
import { space } from '@/theme/tokens';
import { Button, Txt } from '@/ui/primitives';
import { CenterSheet } from '@/ui/sheet';
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
});
