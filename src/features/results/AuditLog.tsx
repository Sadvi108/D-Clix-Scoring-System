// Phase 7 · Audit history (P_AuditLog). Append-only: every row is written by the server, never edited.
import { useState } from 'react';
import { View } from 'react-native';
import type { AuditEntry } from '@/core/types';
import { useScoring } from '@/data';
import { hhmmss } from '@/features/officials/helpers';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';
import { ChipRow } from '@/ui/console';
import { Panel, Txt } from '@/ui/primitives';

type Filter = 'ALL' | AuditEntry['area'];

const ACTION: Record<string, string> = {
  CALL: 'Called', ON_MAT: 'On mat', OPEN: 'Scoring opened', SEND: 'Score sent', COMPLETE: 'Panel complete', HAND_TO_RIC: 'Handed to RIC',
  RELEASE: 'Result released', CORRECTION_REQUEST: 'Correction asked', WITHDRAW: 'Withdrawn', BOUT_DECISION: 'Bout decided',
  ROUND_SCORED: 'Round scored', TIE_RESOLVE: 'Tie resolved', QUALIFY_CONFIRM: 'Round confirmed', ROUND_SCHEDULE: 'Round scheduled',
  RULESET_EDIT: 'Rules edited', RULESET_APPROVE: 'Rules approved', ROUND_EDIT: 'Round edited', PANEL_SIZE: 'Panel size', SEAT_ASSIGN: 'Seat assigned',
  DEVICE_PAIR: 'Device paired', DEVICE_UNPAIR: 'Device unpaired',
};

export function AuditLog({ wide }: { wide: boolean }) {
  const { c } = useTheme();
  const s = useScoring();
  const [f, setF] = useState<Filter>('ALL');
  const rows = s.audit.filter((a) => f === 'ALL' || a.area === f);
  const count = (x: Filter) => (x === 'ALL' ? s.audit.length : s.audit.filter((a) => a.area === x).length);

  return (
    <View style={{ gap: space[3] }}>
      <ChipRow value={f} onChange={setF} options={(['ALL', 'SCORING', 'RESULTS', 'SETUP'] as Filter[]).map((x) => ({ value: x, label: x === 'ALL' ? 'All' : x[0] + x.slice(1).toLowerCase(), hint: String(count(x)) }))} />
      <Panel style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        {rows.map((a) => (
          <View key={a.id} style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? space[3] : 2, paddingHorizontal: space[3], paddingVertical: space[2], borderBottomWidth: 1, borderBottomColor: c.hairline }}>
            <View style={{ flexDirection: 'row', gap: space[3], width: wide ? 330 : undefined }}>
              <Txt v="mono" color="inkMuted" style={{ width: 66 }}>{hhmmss(a.at)}</Txt>
              <Txt v="label" style={{ width: 110 }} numberOfLines={1}>{a.actor}</Txt>
              <Txt v="label" color={a.area === 'RESULTS' ? 'okText' : a.area === 'SETUP' ? 'goldText' : 'chungText'} numberOfLines={1} style={{ flex: 1 }}>{ACTION[a.action] ?? a.action}</Txt>
            </View>
            <Txt v="caption" style={{ flex: 1, paddingLeft: wide ? 0 : 78 }}>
              {a.target}{a.detail ? <Txt v="caption" color="inkMuted">  ·  {a.detail}</Txt> : null}
            </Txt>
          </View>
        ))}
        {rows.length === 0 ? <Txt v="body" color="inkMuted" style={{ padding: space[4] }}>Nothing recorded yet.</Txt> : null}
      </Panel>
      <Txt v="caption" color="inkMuted">Append-only. Corrections add a new revision and a new row; nothing is edited or deleted.</Txt>
    </View>
  );
}
