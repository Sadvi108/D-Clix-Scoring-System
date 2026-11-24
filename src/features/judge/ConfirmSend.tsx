// Send confirmation: the judge checks the totals before the score goes to the server. After sending the
// score is locked; only the chief referee can reopen it.
import { View } from 'react-native';
import { KeypadCapture } from '@/device/keypad';
import { isFreestyle } from '@/sports/poomsae/rules';
import { space } from '@/theme/tokens';
import { Button, Txt, f1 } from '@/ui/primitives';
import { CenterSheet } from '@/ui/sheet';
import type { useJudge } from './useJudge';

export function ConfirmSend({ j }: { j: ReturnType<typeof useJudge> }) {
  const { s, cur, sides, chung, hong, confirming, confirmSend, cancelSend } = j;
  if (!confirming || !cur) return null;
  const fs = isFreestyle(s.rules);
  const pk = cur.format === 'PK' && !!cur.hong;
  return (
    <CenterSheet title="Send your score?" subtitle={`Match ${cur.matchNo} · ${cur.form}${pk ? '' : ` · Form ${cur.formNo}`}`} onClose={cancelSend} width={pk ? 620 : 460}>
      <KeypadCapture onAction={(a) => { if (a.kind === 'send') confirmSend(); else if (a.kind === 'cancel') cancelSend(); }} />
      <View style={{ flexDirection: 'row', gap: space[3] }}>
        {sides.map((sd) => {
          const m = sd === 'chung' ? chung : hong;
          const ath = sd === 'chung' ? cur.chung : cur.hong!;
          return (
            <View key={sd} style={{ flex: 1, gap: 4 }}>
              <Txt v="label" color={pk ? (sd === 'chung' ? 'chungText' : 'hongText') : 'chungText'} numberOfLines={1}>{ath.name}</Txt>
              <Row k={fs ? 'Technical' : 'Accuracy'} v={f1(m.accuracy)} />
              <Row k="Presentation" v={f1(m.presentation)} />
              {fs && m.deduction > 0 ? <Row k="Deductions" v={`−${f1(m.deduction)}`} /> : null}
              <Row k="Total" v={f1(m.total)} strong />
            </View>
          );
        })}
      </View>
      <Txt v="caption" color="inkMuted">You cannot change the score after sending. Only the chief referee can reopen it.</Txt>
      <View style={{ flexDirection: 'row', gap: space[3], justifyContent: 'flex-end' }}>
        <Button label="Back" variant="secondary" onPress={cancelSend} />
        <Button label="Send" icon="send" onPress={confirmSend} style={{ minWidth: 160 }} />
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
