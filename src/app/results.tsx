// Ranking of one cut-off round from GET /rounds/{id}/results; the chief confirms the qualifiers
// (POST /rounds/{id}/qualify, confirmed) once every athlete is scored and no tie straddles the cut.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ApiError } from '@/api/client';
import { ChiefShell } from '@/features/chief/ChiefShell';
import { ToneTag } from '@/features/chief/ToneTag';
import { api, session, useSession } from '@/live';
import { resultsView } from '@/live/chiefView';
import { usePolled } from '@/live/usePolled';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { confirm } from '@/ui/confirm';
import { Notice } from '@/ui/console';
import { Button, Panel, Txt } from '@/ui/primitives';

export default function ResultsScreen() {
  return <ChiefShell tab="rounds"><Results /></ChiefShell>;
}

function Results() {
  const router = useRouter();
  const { c } = useTheme();
  const role = useSession().profile?.role ?? 'OPERATOR';
  const { round } = useLocalSearchParams<{ round?: string }>();
  const roundId = Number(round);
  const valid = !!round && Number.isFinite(roundId);
  const { data, error, setData, reload } = usePolled(() => (valid ? api.roundResults(roundId) : Promise.resolve(null)), valid ? 10000 : 0, [roundId, valid]);
  const [busy, setBusy] = useState(false);
  // Set before the confirmation opens, so a double tap cannot send the final action twice.
  const busyRef = useRef(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'alert' } | null>(null);
  const back = <Button label="‹  Rounds" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chief/rounds'))} />;
  if (!valid) return <>{back}<Txt v="body" color="inkMuted">Choose a round from the Rounds tab.</Txt></>;
  if (!data) return <>{back}<Notice text={error} />{error ? null : <Txt v="body" color="inkMuted">Loading…</Txt>}</>;
  const v = resultsView(data, role);

  async function qualify() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const yes = await confirm({ title: 'Confirm the qualifiers?', message: `${data!.qualifyCount ?? ''} athletes go through. The next round list is then generated in TMS.`, ok: 'Confirm qualifiers', cancel: 'Cancel' });
      if (!yes) return;
      setMsg(null);
      const r = await api.qualify(roundId);
      if (r.results) setData(r.results);
      setMsg({ text: 'Qualifiers confirmed.', tone: 'ok' });
    } catch (e) {
      session.handleError(e);
      setMsg({ text: e instanceof ApiError ? e.message : String(e), tone: 'alert' });
    } finally {
      busyRef.current = false;
      setBusy(false);
      // Drops a poll that started before the action and loads the server's state now.
      reload();
    }
  }

  const cell = (t: string, w: number | 'flex', opts: { bold?: boolean; muted?: boolean } = {}) => (
    <Txt v={opts.bold ? 'label' : 'body'} color={opts.muted ? 'inkMuted' : 'ink'} numberOfLines={1} style={w === 'flex' ? { flex: 1, minWidth: 140 } : { width: w, textAlign: 'right' }}>{t}</Txt>
  );
  return (
    <>
      <View style={styles.head}>
        {back}
        <View style={{ flex: 1, minWidth: 220 }}>
          <Txt v="title" style={{ fontSize: 24 }}>{v.title}</Txt>
          <Txt v="caption" color="inkMuted">{[v.sub, v.cut].filter(Boolean).join(' · ')}</Txt>
        </View>
      </View>
      {msg ? <Notice text={msg.text} tone={msg.tone} /> : null}
      <Panel style={{ padding: 0, overflow: 'hidden' }}>
        <ScrollView horizontal contentContainerStyle={{ minWidth: '100%' }}>
          <View style={{ flex: 1, minWidth: 620 }}>
            <View style={[styles.tr, { backgroundColor: c.surfaceSunken }]}>
              {cell('Rank', 56, { muted: true })}<View style={{ width: space[3] }} />{cell('Athlete', 'flex', { muted: true })}
              {cell('Total', 80, { muted: true })}{cell(v.partLabel, 70, { muted: true })}{cell('Pres', 70, { muted: true })}<View style={{ width: 120 }} />
            </View>
            {v.rows.map((r) => (
              <View key={r.entryId} style={[styles.tr, { borderTopWidth: 1, borderTopColor: c.hairline }]}>
                <View style={{ width: 56, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
                  <Txt v={r.bold ? 'label' : 'body'}>{r.rank}</Txt>
                </View>
                <View style={{ width: space[3] }} />
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Txt v={r.bold ? 'label' : 'body'} numberOfLines={1}>{r.name}</Txt>
                  {r.team ? <Txt v="caption" color="inkMuted" numberOfLines={1}>{r.team}</Txt> : null}
                </View>
                {cell(r.total, 80, { bold: true })}{cell(r.part, 70)}{cell(r.presentation, 70)}
                <View style={{ width: 120, flexDirection: 'row', justifyContent: 'flex-end', gap: 4 }}>
                  {r.tie ? <ToneTag label="Tie" tone="bad" /> : null}
                  {r.tag ? <ToneTag label={r.tag.label} tone={r.tag.tone} /> : null}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </Panel>
      {v.footer ? <Txt v="body" color={v.footer.tone === 'bad' ? 'alertText' : v.footer.tone === 'ok' ? 'okText' : 'inkMuted'}>{v.footer.text}</Txt> : null}
      {v.showConfirm ? <Button label={busy ? 'Confirming…' : 'Confirm qualifiers'} icon="check" size="lg" disabled={busy || !v.canConfirm} onPress={() => void qualify()} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], flexWrap: 'wrap' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], minHeight: 48, gap: space[2], borderRadius: radius.sm },
});
