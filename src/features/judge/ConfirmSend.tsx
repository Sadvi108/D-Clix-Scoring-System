// Send confirmation: the judge checks the totals before the score goes to the server. After sending the
// score is locked; only the chief referee can reopen it.
import { View } from 'react-native';
import { KeypadCapture } from '@/device/keypad';
import type { Side } from '@/live/judgeView';
import { space } from '@/theme/tokens';
import { Button, Txt, f1 } from '@/ui/primitives';
import { CenterSheet } from '@/ui/sheet';
import type { JudgeModel } from './model';

export function ConfirmSend({ j }: { j: JudgeModel }) {
  const v = j.view;
  if (!j.confirming || !j.sheet) return null;
  const free = v.mode === 'freestyle';
  const pk = !!v.chung && !!v.hong;
  const sides: Side[] = pk ? ['chung', 'hong'] : ['chung'];
  const [first, second] = j.sheet.sections;
  return (
    <CenterSheet title="Send your score?" subtitle={`Game ${v.gameNo} · ${v.formName}${v.formCount > 1 ? ` · Form ${v.formNo} of ${v.formCount}` : ''}`} onClose={j.cancelSend} width={pk ? 620 : 460}>
      <KeypadCapture onAction={(a) => { if (a.kind === 'send') j.confirmSend(); else if (a.kind === 'cancel') j.cancelSend(); }} />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        {sides.map((sd) => {
          const side = v[sd];
          if (!side) return null;
          const cl = side.calc;
          return (
            <View key={sd} style={{ flex: 1, gap: 4 }}>
              <Txt v="label" color={pk ? (sd === 'chung' ? 'chungText' : 'hongText') : 'chungText'} numberOfLines={1}>{side.athlete.name}</Txt>
              <Row k={first.label} v={f1(cl ? (free ? cl.techSum : cl.acc) : null)} />
              <Row k={second?.label ?? 'Presentation'} v={f1(cl?.ok ? (free ? cl.presSum : cl.pres) : null)} />
              {free && cl && cl.ded > 0 ? <Row k="Deductions" v={`−${f1(cl.ded)}`} /> : null}
              <Row k="Total" v={f1(cl?.ok ? cl.tot : null)} strong />
            </View>
          );
        })}
      </View>
      <Txt v="caption" color="inkMuted">You cannot change the score after sending. Only the chief referee can reopen it.</Txt>
      <View style={{ flexDirection: 'row', gap: space[3], justifyContent: 'flex-end' }}>
        <Button label="Back" variant="secondary" onPress={j.cancelSend} />
        <Button label="Send" icon="send" onPress={j.confirmSend} style={{ minWidth: 160 }} />
      </View>
    </CenterSheet>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Txt v="caption" color="inkMuted">{k}</Txt>
      <Txt v="scoreMd" color={strong ? 'goldText' : 'ink'} style={{ fontSize: strong ? 24 : 18 }}>{v}</Txt>
    </View>
  );
}
