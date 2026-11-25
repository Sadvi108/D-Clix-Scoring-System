// The judge screens' single input: the view (what to show) plus the actions (what the judge can do).
// Built by useJudgeLive in the app, and from fixtures by the dev preview.
import type { Corner, Sheet, SheetItem, SheetKey } from '@/api/types';
import type { JudgeLocal, LocalCtx } from '@/live/judgeLocal';
import type { JudgeView, Side } from '@/live/judgeView';
import type { Local } from '@/live/sheetCalc';
import type { GridRow } from '@/ui/scoreGrid';

export interface JudgeModel {
  view: JudgeView;
  sheet: Sheet | null;
  confirming: boolean;
  tap(side: Side, code: string): void;
  undo(side: Side, code: string): void;
  /** Item values in points (0.1 = one tenth). */
  setItems(side: Side, items: Record<string, number>): void;
  pressSend(): void;
  confirmSend(): void;
  cancelSend(): void;
}

export function makeModel(o: {
  view: JudgeView;
  sheet: Sheet | null;
  local: JudgeLocal;
  ctx: LocalCtx | null;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  onSend: () => void;
}): JudgeModel {
  const corner = (sd: Side): Corner | null => o.view[sd]?.corner ?? null;
  const act = (sd: Side, fn: (c: LocalCtx, cn: Corner) => void) => {
    const cn = corner(sd);
    if (!o.ctx || !cn || o.view.locked) return;
    fn(o.ctx, cn);
  };
  const canSend = () => o.view.sendState === 'ready' || o.view.sendState === 'failed';
  return {
    view: o.view,
    sheet: o.sheet,
    confirming: o.confirming,
    tap: (sd, code) => act(sd, (c, cn) => o.local.tap(c, cn, code)),
    undo: (sd, code) => act(sd, (c, cn) => o.local.undo(c, cn, code)),
    setItems: (sd, items) => act(sd, (c, cn) => o.local.setItems(c, cn, items)),
    pressSend: () => { if (canSend()) o.setConfirming(true); },
    confirmSend: () => { o.setConfirming(false); if (canSend()) o.onSend(); },
    cancelSend: () => o.setConfirming(false),
  };
}

export const toTenths = (v: number | undefined | null) => (v == null ? null : Math.round(v * 10));
export const fromTenths = (vals: Record<string, number>) =>
  Object.fromEntries(Object.entries(vals).map(([k, t]) => [k, t / 10]));

/** Number-grid rows (tenths) for some sheet items and the judge's current values. */
export function gridRows(items: SheetItem[], L: Local): GridRow[] {
  return items.map((it) => ({
    key: it.code,
    label: it.label,
    sub: it.hint,
    min: Math.round(it.min * 10),
    max: Math.round(it.max * 10),
    step: Math.max(1, Math.round(it.step * 10)),
    value: toTenths(L.items[it.code]),
  }));
}

/** USB keypad "undo": remove one minor deduction, else one major. */
export function keypadUndo(L: Local, keys: { major?: SheetKey; minor?: SheetKey }): string | null {
  for (const k of [keys.minor, keys.major]) if (k && (L.ded[k.code] ?? 0) > 0) return k.code;
  return null;
}

export function receiptTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
