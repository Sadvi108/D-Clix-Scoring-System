// Pure Poomsae scoring functions. No React, no I/O — the same file can run on the server.
// All arithmetic is in integer tenths to avoid floating-point drift; convert only for display.

import type { ScoreEvent, Side, SideResult } from '@/core/types';
import type { RuleSet } from './rules';

/** Active deduction events for one judge + side, after applying UNDO reversals. */
export function activeTaps(events: ScoreEvent[], judgeNo: number, side: Side): ScoreEvent[] {
  const mine = events.filter((e) => e.judgeNo === judgeNo && e.side === side);
  const reversed = new Set(mine.filter((e) => e.type === 'UNDO' && e.reversesEventId).map((e) => e.reversesEventId!));
  return mine.filter((e) => e.type === 'TAP' && !reversed.has(e.eventId));
}

export function tapCounts(rules: RuleSet, taps: ScoreEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of rules.deductions) out[d.code] = 0;
  for (const t of taps) if (t.deductionCode) out[t.deductionCode] = (out[t.deductionCode] ?? 0) + 1;
  return out;
}

/** Accuracy = max(0, max − Σ deductions), in tenths. */
export function accuracyTenths(rules: RuleSet, taps: ScoreEvent[]): number {
  const amount = (code?: string) => rules.deductions.find((d) => d.code === code)?.tenths ?? 0;
  const sum = taps.reduce((a, t) => a + amount(t.deductionCode), 0);
  return Math.max(0, rules.accuracyMaxTenths - sum);
}

/** Sum of the tapped deductions, in tenths (Freestyle takes it off the total). */
export function deductionTenths(rules: RuleSet, taps: ScoreEvent[]): number {
  return taps.reduce((a, t) => a + (rules.deductions.find((d) => d.code === t.deductionCode)?.tenths ?? 0), 0);
}

/** Whether one more deduction of this code keeps accuracy at or above zero. */
export function canDeduct(rules: RuleSet, currentAccTenths: number, code: string): boolean {
  const d = rules.deductions.find((x) => x.code === code);
  return !!d && currentAccTenths - d.tenths >= 0;
}

export function clampCriterion(rules: RuleSet, index: number, tenths: number): number {
  const c = rules.criteria[index];
  return Math.min(c.maxTenths, Math.max(c.minTenths, tenths));
}

/** Presentation in tenths, or null while any criterion is unset. Capped at the profile maximum. */
export function presentationTenths(rules: RuleSet, criteria: (number | null)[]): number | null {
  if (criteria.length !== rules.criteria.length || criteria.some((v) => v == null)) return null;
  const sum = rules.criteria.reduce((a, c, i) => (c.group === 'TECHNICAL' ? a : a + (criteria[i] as number)), 0);
  return Math.min(rules.presentationMaxTenths, sum);
}

/** Freestyle technical skills in tenths (sum of TECHNICAL items), or null while any of them is unset. */
export function technicalTenths(rules: RuleSet, criteria: (number | null)[]): number | null {
  let sum = 0;
  for (let i = 0; i < rules.criteria.length; i++) {
    if (rules.criteria[i].group !== 'TECHNICAL') continue;
    const v = criteria[i];
    if (v == null) return null;
    sum += v;
  }
  return Math.min(rules.accuracyMaxTenths, sum);
}

/** Running sum of the set items of one group (for live display before every item is set). */
export function partialTenths(rules: RuleSet, criteria: (number | null)[], group: 'TECHNICAL' | 'PRESENTATION'): number {
  return rules.criteria.reduce((a, c, i) => ((c.group ?? 'PRESENTATION') === group ? a + (criteria[i] ?? 0) : a), 0);
}

export const toPoints = (tenths: number | null) => (tenths == null ? null : tenths / 10);

/**
 * Panel aggregation. 3 judges: average all. 5/7: drop one highest and one lowest judge total, average the rest.
 * NOTE: total-wise trimming is the DRAFT method (TrimMode = PENDING_APPROVAL in RuleSet 1).
 * Ties for highest/lowest drop the lowest judge number (placeholder until the rule is approved).
 */
export function aggregate(rules: RuleSet, totalsByJudge: { judgeNo: number; totalTenths: number }[]): SideResult | null {
  if (totalsByJudge.length === 0) return null;
  const sorted = [...totalsByJudge].sort((a, b) => a.judgeNo - b.judgeNo);
  if (sorted.length <= 3) {
    const avg = sorted.reduce((a, b) => a + b.totalTenths, 0) / sorted.length / 10;
    return { final: round4(avg), excludedHigh: null, excludedLow: null };
  }
  const hi = sorted.reduce((a, b) => (b.totalTenths > a.totalTenths ? b : a));
  const rest = sorted.filter((x) => x !== hi);
  const lo = rest.reduce((a, b) => (b.totalTenths < a.totalTenths ? b : a));
  const kept = rest.filter((x) => x !== lo);
  const avg = kept.reduce((a, b) => a + b.totalTenths, 0) / kept.length / 10;
  return { final: round4(avg), excludedHigh: hi.judgeNo, excludedLow: lo.judgeNo };
}

export function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
