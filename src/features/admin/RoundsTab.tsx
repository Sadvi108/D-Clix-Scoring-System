// Phase 2 · Tournament category and round setup (P_CategoryRound, P_RoundForm).
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { CategoryMode, CategoryRound, RoundStatus } from '@/core/types';
import { api, useScoring } from '@/data';
import { TMS_FORMS } from '@/data/mock/seed';
import { isConfigured } from '@/sports/poomsae/rules';
import { useTheme } from '@/theme/ThemeContext';
import { radius, space } from '@/theme/tokens';
import { ChipRow, KV, MiniStepper, Notice, PickerSheet } from '@/ui/console';
import { Segmented } from '@/ui/officials';
import { Button, Icon, Panel, RuleBadge, Txt, type BadgeTone } from '@/ui/primitives';

export const MODE_LABEL: Record<CategoryMode, string> = { CUTOFF: 'Cut-off', PK: 'PK', PK_CUTOFF: 'PK + Cut-off' };
export const STATUS: Record<RoundStatus, { tone: BadgeTone; label: string }> = {
  SETUP: { tone: 'unconfigured', label: 'Setup' },
  READY: { tone: 'draft', label: 'Ready' },
  LIVE: { tone: 'pending', label: 'In progress' },
  SCORED: { tone: 'approved', label: 'Scored' },
  CONFIRMED: { tone: 'released', label: 'Confirmed' },
};

export function RoundsTab({ wide }: { wide: boolean }) {
  const s = useScoring();
  const [cat, setCat] = useState(s.setup.categories[0].id);
  const [msg, setMsg] = useState<string | null>(null);
  const category = s.setup.categories.find((x) => x.id === cat)!;
  const rounds = s.setup.rounds.filter((r) => r.categoryId === cat).sort((a, b) => a.order - b.order);

  return (
    <View style={{ gap: space[4] }}>
      <ChipRow value={cat} onChange={(v) => { setCat(v); setMsg(null); }} options={s.setup.categories.map((x) => ({ value: x.id, label: x.name, hint: MODE_LABEL[x.mode] }))} />
      <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: space[2] }}>
          <Txt v="title">{category.name}</Txt>
          <RuleBadge tone="draft" label={MODE_LABEL[category.mode]} />
        </View>
        <View style={{ flexDirection: wide ? 'row' : 'column', columnGap: space[5] }}>
          <View style={{ flex: 1 }}>
            <KV k="TMS category">{category.tmsCategoryId}</KV>
            <KV k="Discipline">{category.discipline === 'RECOGNIZED' ? 'Recognized' : 'Freestyle'}</KV>
          </View>
          <View style={{ flex: 1 }}>
            <KV k="Division">{category.division}</KV>
            <KV k="Rounds">{rounds.map((r) => r.name).join(' › ')}</KV>
          </View>
        </View>
        {category.mode === 'PK_CUTOFF' ? <Txt v="caption" color="inkMuted">PK + Cut-off: Cut-off rounds first; rounds set to PK are decided by bouts.</Txt> : null}
      </Panel>
      <Notice text={msg} />
      <View style={{ flexDirection: wide ? 'row' : 'column', flexWrap: wide ? 'wrap' : 'nowrap', gap: space[4] }}>
        {rounds.map((r) => <RoundCard key={r.id} round={r} wide={wide} onError={setMsg} />)}
      </View>
    </View>
  );
}

function RoundCard({ round: r, wide, onError }: { round: CategoryRound; wide: boolean; onError: (m: string | null) => void }) {
  const { c } = useTheme();
  const s = useScoring();
  const [formSlot, setFormSlot] = useState<number | null>(null);
  const editable = r.status === 'SETUP' || r.status === 'READY';
  const rules = s.setup.ruleSets.find((x) => x.id === r.ruleSetId);
  const entries = s.results.entries[r.id]?.length ?? 0;
  const bouts = s.results.bouts.filter((b) => b.roundId === r.id).length;

  const save = async (patch: Parameters<typeof api.updateRound>[1]) => {
    const res = await api.updateRound(r.id, patch);
    onError(res.ok ? null : res.error);
  };

  return (
    <Panel style={{ flexBasis: wide ? '47%' : 'auto', flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], flexShrink: 1 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="label">{r.order}</Txt>
          </View>
          <Txt v="heading" numberOfLines={1} style={{ flexShrink: 1 }}>{r.name}</Txt>
        </View>
        <RuleBadge tone={STATUS[r.status].tone} label={STATUS[r.status].label} />
      </View>

      <View style={{ gap: space[3] }}>
        <Row label="Format">
          {editable ? (
            <Segmented value={r.format} onChange={(v) => save(v === 'PK' ? { format: v, forms: r.forms.slice(0, 1) } : { format: v })}
              options={[{ value: 'CUTOFF', label: 'Cut-off' }, { value: 'PK', label: 'PK' }]} />
          ) : <Txt v="label">{r.format === 'PK' ? 'PK' : 'Cut-off'}</Txt>}
        </Row>

        <Row label={r.format === 'PK' ? 'Form' : 'Forms'}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'flex-end' }}>
            {r.forms.map((f, i) => (
              <Pressable key={f.formNo} disabled={!editable} onPress={() => setFormSlot(i)} accessibilityRole="button" accessibilityLabel={`Form ${f.formNo}: ${f.name}. Change`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: c.hairline, backgroundColor: c.surfaceRaised }}>
                <Txt v="caption" color="inkMuted">{f.formNo}</Txt>
                <Txt v="label">{f.name}</Txt>
                {editable ? <Icon name="pencil" size={13} color={c.inkMuted} /> : null}
              </Pressable>
            ))}
            {editable && r.format === 'CUTOFF' ? (
              r.forms.length === 1
                ? <Button label="Add form" icon="plus" variant="ghost" onPress={() => save({ forms: [...r.forms, { formNo: 2, tmsFormId: 'TMS-FRM-KORYO', name: 'Koryo' }] })} style={{ minHeight: 36, paddingHorizontal: 8 }} />
                : <Button label="Remove" icon="minus" variant="ghost" onPress={() => save({ forms: r.forms.slice(0, 1) })} style={{ minHeight: 36, paddingHorizontal: 8 }} />
            ) : null}
          </View>
        </Row>

        <Row label="Judges">
          {editable ? (
            <Segmented value={String(r.judgeCount)} onChange={(v) => save({ judgeCount: Number(v) })}
              options={(rules?.judgeCounts ?? [3, 5, 7]).map((n) => ({ value: String(n), label: String(n) }))} />
          ) : <Txt v="label">{r.judgeCount}</Txt>}
        </Row>

        <Row label={r.advanceCount == null ? 'Result' : r.format === 'PK' ? 'Winners advance' : 'Advance'}>
          {r.advanceCount == null ? <Txt v="label">Final · medals</Txt>
            : editable && r.format === 'CUTOFF'
              ? <MiniStepper label="Entries that advance" value={r.advanceCount} min={1} max={32} onChange={(v) => save({ advanceCount: v })} />
              : <Txt v="label">{r.advanceCount}</Txt>}
        </Row>

        <Row label="Rule set">
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Txt v="label">{rules ? `${rules.name} v${rules.version}` : '—'}</Txt>
            {rules && !isConfigured(rules) ? <RuleBadge tone="pending" label="Not configured" /> : null}
          </View>
        </Row>

        <Row label={r.format === 'PK' ? 'Bouts' : 'Entries'}>
          <Txt v="label" color={entries || bouts ? 'ink' : 'inkMuted'}>{r.format === 'PK' ? (bouts ? `${bouts} bouts` : 'From previous round') : entries ? `${entries} entries` : r.order === 1 ? 'From TMS registration' : 'From previous round'}</Txt>
        </Row>
      </View>
      {!editable ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon name="lock" size={14} color={c.inkMuted} /><Txt v="caption" color="inkMuted">Locked: this round has started.</Txt></View> : null}

      <PickerSheet visible={formSlot != null} title={`Form ${formSlot != null ? formSlot + 1 : ''} · ${r.name}`} items={TMS_FORMS} keyOf={(x) => x}
        selected={formSlot != null ? r.forms[formSlot]?.name : null}
        render={(x) => <Txt v="label">{x}</Txt>}
        onClose={() => setFormSlot(null)}
        onPick={(name) => {
          const i = formSlot!;
          setFormSlot(null);
          save({ forms: r.forms.map((f, j) => (j === i ? { ...f, name, tmsFormId: `TMS-FRM-${name.toUpperCase().replace(/\s/g, '')}` } : f)) });
        }} />
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3], flexWrap: 'wrap' }}>
      <Txt v="caption" color="inkMuted">{label}</Txt>
      {children}
    </View>
  );
}
