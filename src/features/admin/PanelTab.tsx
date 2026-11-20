// Phase 3 · Judge assignment and phone connection (P_JudgeAssignment).
import { useState } from 'react';
import { View } from 'react-native';
import type { Official, PanelSeat } from '@/core/types';
import { api, useScoring } from '@/data';
import { hhmmss } from '@/features/officials/helpers';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { KV, Notice, PickerSheet } from '@/ui/console';
import { Segmented } from '@/ui/officials';
import { Button, Icon, Panel, StatusPill, Txt } from '@/ui/primitives';

const CLEAR: Official = { officialId: '', name: 'Leave seat empty', nat: '', licence: 'National', role: 'JUDGE' };

export function PanelTab({ wide }: { wide: boolean }) {
  const s = useScoring();
  const [msg, setMsg] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const panel = s.setup.panel;
  const seats = panel.seats.slice(0, panel.judgeCount);
  const official = (oid: string | null) => s.setup.officials.find((o) => o.officialId === oid);
  const paired = seats.filter((x) => x.pairedAt).length;
  const nextPerf = s.queue.find((p) => p.status === 'QUEUED');
  const nextRound = s.setup.rounds.find((r) => r.id === nextPerf?.roundId);
  const mismatch = nextRound && nextRound.judgeCount !== panel.judgeCount;

  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    setMsg(r.ok ? null : r.error ?? 'Not saved');
  };

  return (
    <View style={{ gap: space[4] }}>
      <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: space[3] }}>
          <View style={{ gap: 2 }}>
            <Txt v="title">{s.ring.name} panel</Txt>
            <Txt v="caption" color="inkMuted">{s.ring.session}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Txt v="caption" color="inkMuted">Judges</Txt>
            <Segmented value={String(panel.judgeCount)} onChange={(v) => run(api.setPanelSize(Number(v)))}
              options={['3', '5', '7'].map((v) => ({ value: v, label: v }))} />
          </View>
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', columnGap: space[5] }}>
          <View style={{ flex: 1 }}>
            <KV k="Chief referee">{`${official(panel.chiefReferee)?.name ?? '—'} · ${official(panel.chiefReferee)?.nat ?? ''}`}</KV>
            <KV k="Ring operator">{`${official(panel.operator)?.name ?? '—'} · ${official(panel.operator)?.nat ?? ''}`}</KV>
          </View>
          <View style={{ flex: 1 }}>
            <KV k="Devices paired">{`${paired} of ${panel.judgeCount}`}</KV>
            <KV k="Next on the mat">{nextPerf ? `Match ${nextPerf.matchNo} · ${nextRound?.judgeCount ?? '?'} judges` : '—'}</KV>
          </View>
        </View>
        {mismatch ? <Notice text={`${nextRound!.name} (match ${nextPerf!.matchNo}) needs ${nextRound!.judgeCount} judges. The operator cannot call it until the panel matches.`} /> : null}
        <Notice text={msg} />
      </Panel>

      <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: wide ? 'wrap' : 'nowrap', gap: space[3] }}>
        {seats.map((seat) => <SeatCard key={seat.judgeNo} seat={seat} wide={wide} official={official(seat.officialId)} onAssign={() => setPick(seat.judgeNo)} onRun={run} />)}
      </View>
      <Txt v="caption" color="inkMuted">Each seat is one P_JudgeAssignment. The judge enters the pairing code on their own phone or tablet; the code works once and expires in 60 seconds. A new official on a seat must pair again.</Txt>

      <PickerSheet visible={pick != null} title={`Judge seat J${pick ?? ''}`} keyOf={(o) => o.officialId || 'clear'}
        selected={pick != null ? panel.seats[pick - 1]?.officialId : null}
        items={[...s.setup.officials.filter((o) => o.role === 'JUDGE'), CLEAR]}
        render={(o) => {
          const at = panel.seats.find((x) => x.officialId === o.officialId && x.judgeNo !== pick && x.judgeNo <= panel.judgeCount);
          return o.officialId ? (
            <View>
              <Txt v="label">{o.name} · {o.nat}</Txt>
              <Txt v="caption" color="inkMuted">{o.officialId} · {o.licence}{at ? ` · now on J${at.judgeNo} (moves here)` : ''}</Txt>
            </View>
          ) : <Txt v="label" color="alertText">{o.name}</Txt>;
        }}
        onClose={() => setPick(null)}
        onPick={(o) => { const j = pick!; setPick(null); run(api.assignSeat(j, o.officialId || null)); }} />
    </View>
  );
}

function SeatCard({ seat, wide, official, onAssign, onRun }: { seat: PanelSeat; wide: boolean; official?: Official; onAssign: () => void; onRun: (p: Promise<{ ok: boolean; error?: string }>) => void }) {
  const { c } = useTheme();
  const isMe = seat.deviceName === 'This device';
  return (
    <Panel style={{ flexBasis: wide ? '31%' : 'auto', flexGrow: 1, gap: space[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="scoreMd" color={c.ground} style={{ fontSize: 20 }}>J{seat.judgeNo}</Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {official ? (
            <>
              <Txt v="label" numberOfLines={1}>{official.name} · {official.nat}</Txt>
              <Txt v="caption" color="inkMuted" numberOfLines={1}>{official.officialId} · {official.licence}</Txt>
            </>
          ) : <Txt v="label" color="alertText">No judge assigned</Txt>}
        </View>
        <Button icon="pencil" variant="secondary" accessibilityLabel={`Change judge on seat ${seat.judgeNo}`} onPress={onAssign} style={{ minHeight: 40, paddingHorizontal: 12 }} />
      </View>

      {seat.pairedAt ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="device" size={18} color={c.okText} />
            <View>
              <Txt v="label">{seat.deviceName}</Txt>
              <Txt v="caption" color="inkMuted">Paired {hhmmss(seat.pairedAt)}</Txt>
            </View>
          </View>
          {isMe ? <StatusPill status="online" label="This device" compact /> : <Button label="Unpair" icon="close" variant="ghost" onPress={() => onRun(api.unpairDevice(seat.judgeNo))} style={{ minHeight: 40 }} />}
        </View>
      ) : seat.pairingCode ? (
        <View style={{ alignItems: 'center', gap: 4, padding: space[3], borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.goldText, backgroundColor: c.goldSoft }}>
          <Txt v="overline" color="goldText">Pairing code</Txt>
          <Txt v="scoreLg" style={{ letterSpacing: 4 }}>{seat.pairingCode}</Txt>
          <Txt v="caption" color="inkMuted">Waiting for the device · expires {hhmmss(seat.pairingExpiresAt)}</Txt>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="wifi-off" size={18} color={c.alertText} />
            <Txt v="caption" color="alertText">No device paired</Txt>
          </View>
          <Button label="Pair device" icon="link" disabled={!official} onPress={() => onRun(api.pairDevice(seat.judgeNo))} style={{ minHeight: 40 }} />
        </View>
      )}
    </Panel>
  );
}
