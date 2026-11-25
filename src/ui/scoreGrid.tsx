// Number grid for scoring criteria, as on the judge tablet manual: every allowed value is a button
// (2.0 … 0.0 for Recognized presentation, 1.0 … 0.0 for Freestyle items). The judge taps one value per
// row, then OK. Several pages (Freestyle: Technical, then Presentation) are paged with ‹ › and OK.
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { KeypadCapture } from '@/device/keypad';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { Button, Icon, Txt } from './primitives';

export type GridRow = {
  key: string; label: string; sub?: string; min: number; max: number;
  /** Tenths between values (default 1 = 0.1). */
  step?: number;
  value: number | null;
};
export type GridPage = { title: string; rows: GridRow[]; side?: 'chung' | 'hong' | 'solo' };

/** Values from max down to min (tenths), one line per point like the paper sheet: …, 2.0–1.1, then 1.0–0.0. */
function lines(min: number, max: number, step = 1): number[][] {
  const out = new Map<number, number[]>();
  for (let v = max; v >= min; v -= step) {
    const k = v <= 10 ? 1 : Math.ceil(v / 10);
    out.set(k, [...(out.get(k) ?? []), v]);
  }
  return [...out.values()];
}

/** Mount only while open: it starts from the values passed in and gives them back on OK. Close discards. */
export function ScoreGrid({ title, side = 'chung', pages, startPage = 0, note, onOk, onClose }: {
  title: string; side?: 'chung' | 'hong' | 'solo'; pages: GridPage[]; startPage?: number; note?: string | null;
  onOk: (values: Record<string, number>) => void; onClose: () => void;
}) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const compact = height < 560 || width < 700;
  const [page, setPage] = useState(Math.min(startPage, pages.length - 1));
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(pages.flatMap((p) => p.rows.map((r) => [r.key, r.value]))));
  const cur = pages[page];
  const pageSide = cur.side ?? side;
  const fill = pageSide === 'hong' ? c.hong : c.chung;
  const last = page === pages.length - 1;

  const ok = () => {
    if (!last) { setPage(page + 1); return; }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) if (v != null) out[k] = v;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onOk(out);
  };

  const chipH = compact ? 40 : 48;
  const labelW = compact ? 112 : 190;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <KeypadCapture onAction={(a) => { if (a.kind === 'send') ok(); else if (a.kind === 'cancel') onClose(); }} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: fill, maxWidth: 1000, maxHeight: height - 24, padding: compact ? space[3] : space[5] }]}>
          <View style={styles.head}>
            <NavBtn dir="prev" hidden={pages.length < 2} disabled={page === 0} onPress={() => setPage(page - 1)} />
            <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <Txt v="title" numberOfLines={1} style={{ fontSize: compact ? 17 : 22 }}>{title}</Txt>
              <Txt v="overline" color={pageSide === 'hong' ? 'hongText' : 'chungText'}>{cur.title}{pages.length > 1 ? ` · ${page + 1}/${pages.length}` : ''}</Txt>
            </View>
            <NavBtn dir="next" hidden={pages.length < 2} disabled={last} onPress={() => setPage(page + 1)} />
          </View>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: compact ? 6 : 10 }}>
            {cur.rows.map((r) => {
              const ls = lines(r.min, r.max, r.step);
              const width = Math.max(...ls.map((l) => l.length));
              return (
                <View key={r.key} style={[styles.row, { borderBottomColor: c.hairline }]}>
                  <View style={{ width: labelW }}>
                    <Txt v="label" color={pageSide === 'hong' ? 'hongText' : 'chungText'} style={{ fontSize: compact ? 13 : 16 }}>{r.label}</Txt>
                    {r.sub && !compact ? <Txt v="caption" color="inkMuted">{r.sub}</Txt> : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    {ls.map((l, li) => (
                      <View key={li} style={{ flexDirection: 'row', gap: 4 }}>
                        {[...l, ...Array(width - l.length).fill(null)].map((v: number | null, i) => {
                          if (v == null) return <View key={`e${i}`} style={{ flex: 1 }} />;
                          const on = values[r.key] === v;
                          return (
                            <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${r.label} ${(v / 10).toFixed(1)}`}
                              onPress={() => { Haptics.selectionAsync(); setValues((x) => ({ ...x, [r.key]: v })); }}
                              style={({ pressed }) => [styles.chip, { height: chipH, backgroundColor: on ? fill : pressed ? c.surfaceRaised : 'transparent', borderColor: on ? fill : c.hairline }]}>
                              <Txt v="scoreMd" color={on ? '#ffffff' : 'ink'} style={{ fontSize: compact ? 15 : 20, lineHeight: compact ? 18 : 24 }}>{(v / 10).toFixed(1)}</Txt>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {note ? <Txt v="caption" color="alertText" style={{ textAlign: 'center' }}>{note}</Txt> : null}
          <View style={styles.foot}>
            <Button label={last ? 'OK' : 'OK · next'} icon="check" onPress={ok} style={{ minWidth: compact ? 130 : 180 }} />
            <Button label="Close" variant="secondary" onPress={onClose} style={{ minWidth: compact ? 110 : 150 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function NavBtn({ dir, hidden, disabled, onPress }: { dir: 'prev' | 'next'; hidden?: boolean; disabled?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  if (hidden) return <View style={{ width: 48 }} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={dir === 'prev' ? 'Previous page' : 'Next page'} disabled={disabled} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.nav, { borderColor: c.controlBorder, opacity: disabled ? 0.3 : pressed ? 0.6 : 1, transform: [{ scaleX: dir === 'prev' ? -1 : 1 }] }]}>
      <Icon name="chevron" size={24} color={c.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { width: '100%', borderRadius: radius.lg, borderWidth: 2, gap: space[3] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  nav: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], borderBottomWidth: 1, paddingBottom: 8 },
  chip: { flex: 1, minWidth: 30, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  foot: { flexDirection: 'row', justifyContent: 'center', gap: space[3] },
});
