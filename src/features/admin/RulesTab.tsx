// Phase 1 · Master rules and scoring settings (P_RuleSet, P_DeductionType, P_PresentationCriterion).
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { isConfigured } from '@/sports/poomsae/rules';
import { useTheme } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';
import { ChipRow, KV, MiniStepper, Notice } from '@/ui/console';
import { Button, Panel, RuleBadge, Txt } from '@/ui/primitives';
import { tms as api, useSetupSample as useScoring } from './sample';

const pts = (t: number) => (t / 10).toFixed(1);

export function RulesTab({ wide }: { wide: boolean }) {
  const { c } = useTheme();
  const s = useScoring();
  const [sel, setSel] = useState(String(s.setup.ruleSets[0].id));
  const [msg, setMsg] = useState<{ text: string; tone: 'alert' | 'ok' } | null>(null);
  const rs = s.setup.ruleSets.find((x) => String(x.id) === sel) ?? s.setup.ruleSets[0];
  const configured = isConfigured(rs);
  const editable = rs.status === 'DRAFT';
  const usedBy = s.setup.rounds.filter((r) => r.ruleSetId === rs.id).length;

  const run = async (p: Promise<{ ok: boolean; error?: string }>, okText?: string) => {
    const r = await p;
    setMsg(r.ok ? (okText ? { text: okText, tone: 'ok' } : null) : { text: r.error ?? 'Not saved', tone: 'alert' });
  };

  const approve = () =>
    Alert.alert(`Approve ${rs.name} v${rs.version}?`, 'Approved rules are locked for every round that uses them. Changes then need a new version.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => run(api.approveRuleSet(rs.id), 'Rule set approved and locked.') },
    ]);

  return (
    <View style={{ gap: space[4] }}>
      <ChipRow value={sel} onChange={(v) => { setSel(v); setMsg(null); }}
        options={s.setup.ruleSets.map((x) => ({ value: String(x.id), label: `${x.name} v${x.version}`, hint: isConfigured(x) ? (x.status === 'APPROVED' ? 'Approved' : 'Draft') : 'Not configured' }))} />

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: space[4], alignItems: 'flex-start' }}>
        <Panel style={{ flex: wide ? 1 : undefined, alignSelf: 'stretch' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
            <Txt v="title">{rs.name}</Txt>
            <RuleBadge tone={!configured ? 'unconfigured' : rs.status === 'APPROVED' ? 'approved' : 'draft'} label={!configured ? 'Not configured' : rs.status === 'APPROVED' ? 'Approved' : 'Draft'} />
          </View>
          <View>
            <KV k="RuleSetID · version">{`${rs.id} · v${rs.version}`}</KV>
            <KV k="Discipline">{rs.discipline === 'RECOGNIZED' ? 'Recognized' : 'Freestyle'}</KV>
            <KV k="Accuracy maximum">{pts(rs.accuracyMaxTenths)}</KV>
            <KV k="Presentation maximum">{pts(rs.presentationMaxTenths)}</KV>
            <KV k="Panel sizes">{`${rs.judgeCounts.join(' · ')} judges (default ${rs.defaultJudges})`}</KV>
            <KV k="Trimming (5 or 7 judges)">
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Txt v="label" style={{ textAlign: 'right' }}>Drop {rs.excludeHigh} high + {rs.excludeLow} low judge total</Txt>
                <RuleBadge tone={rs.trimMode === 'APPROVED' ? 'approved' : 'pending'} label={rs.trimMode === 'APPROVED' ? 'Approved' : 'Pending approval'} />
              </View>
            </KV>
            <KV k="Used by">{`${usedBy} round${usedBy === 1 ? '' : 's'}`}</KV>
          </View>
          {!configured ? (
            <Notice tone="info" text={`${rs.name} criteria are not set yet (awaiting WT sign-off). Rounds that use this rule set cannot be called to the mat.`} />
          ) : null}
          <Button label={rs.status === 'APPROVED' ? 'Approved · locked' : 'Approve rule set'} icon={rs.status === 'APPROVED' ? 'lock' : 'check'} block
            disabled onPress={approve} />
          <Notice text={msg?.text ?? null} tone={msg?.tone} />
        </Panel>

        <View style={{ flex: wide ? 1.2 : undefined, alignSelf: 'stretch', gap: space[4] }}>
          <Panel>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt v="overline" color="inkMuted">Accuracy deductions · P_DeductionType</Txt>
              {!editable ? <Txt v="caption" color="inkMuted">Locked</Txt> : null}
            </View>
            {rs.deductions.length === 0 ? <Txt v="body" color="inkMuted">No deductions defined.</Txt> : null}
            {rs.deductions.map((d, i) => (
              <View key={d.code} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], borderBottomWidth: 1, borderBottomColor: c.hairline, paddingVertical: space[2] }}>
                <View style={{ flex: 1 }}>
                  <Txt v="label">{d.label} deduction</Txt>
                  <Txt v="mono" color="inkMuted">{d.code}</Txt>
                </View>
                <MiniStepper label={`${d.label} deduction`} value={d.tenths} min={1} max={10} format={(v) => `−${pts(v)}`} disabled
                  onChange={(v) => run(api.updateRuleSet(rs.id, { deductions: rs.deductions.map((x, j) => (j === i ? { ...x, tenths: v } : x)) }))} />
              </View>
            ))}
          </Panel>

          <Panel>
            <Txt v="overline" color="inkMuted">{rs.discipline === 'FREESTYLE' ? 'Technical + presentation items' : 'Presentation criteria'} · P_PresentationCriterion</Txt>
            {rs.criteria.length === 0 ? <Txt v="body" color="inkMuted">No criteria yet.</Txt> : null}
            {rs.criteria.map((cr, i) => (
              <View key={cr.code} style={{ gap: space[2], borderBottomWidth: 1, borderBottomColor: c.hairline, paddingVertical: space[2] }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
                  <Txt v="label" style={{ flex: 1 }}>{cr.label}</Txt>
                  <Txt v="mono" color="inkMuted">{cr.group === 'TECHNICAL' ? 'TECH · ' : rs.discipline === 'FREESTYLE' ? 'PRES · ' : ''}{cr.code}</Txt>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4], alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Txt v="caption" color="inkMuted">Min</Txt>
                    <MiniStepper label={`${cr.short} minimum`} value={cr.minTenths} min={0} max={cr.maxTenths - 1} format={pts} disabled
                      onChange={(v) => run(api.updateRuleSet(rs.id, { criteria: rs.criteria.map((x, j) => (j === i ? { ...x, minTenths: v } : x)) }))} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Txt v="caption" color="inkMuted">Max</Txt>
                    <MiniStepper label={`${cr.short} maximum`} value={cr.maxTenths} min={cr.minTenths + 1} max={rs.presentationMaxTenths} format={pts} disabled
                      onChange={(v) => run(api.updateRuleSet(rs.id, { criteria: rs.criteria.map((x, j) => (j === i ? { ...x, maxTenths: v } : x)) }))} />
                  </View>
                  <Txt v="caption" color="inkMuted">Step {pts(cr.stepTenths)}</Txt>
                </View>
              </View>
            ))}
            {rs.criteria.length ? (
              <Txt v="caption" color="inkMuted">Min and step are NULL in MAASUAT RuleSet {rs.id}; values follow the WT score sheet until confirmed.</Txt>
            ) : null}
          </Panel>
        </View>
      </View>
    </View>
  );
}
