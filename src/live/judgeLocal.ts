// What the judge has tapped, per ring, game, form and corner. Kept on the tablet while scoring;
// saved to the server as a draft 600 ms after the last change (the operator sees it as yellow),
// restored from the server draft after an app restart, and sent as the final score by the outbox.
import type { Corner, ScoreEntry } from '../api/types';
import type { Local } from './sheetCalc';
import { createStore } from './store';

export interface LocalCtx { ring: string; gameId: string; formNo: number; corners: Corner[] }

const EMPTY: Local = { ded: {}, items: {} };
const formKey = (c: LocalCtx) => `${c.ring}|${c.gameId}|${c.formNo}`;
const key = (c: LocalCtx, corner: Corner) => `${formKey(c)}|${corner}`;

export function createJudgeLocal(o: {
  save: (gameId: string, formNo: number, scores: ScoreEntry[]) => Promise<unknown>;
  canSave: () => boolean;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  debounceMs?: number;
}) {
  const store = createStore<{ values: Record<string, Local> }>({ values: {} });
  const restored = new Set<string>();
  let timer: unknown = null;
  let pending: LocalCtx | null = null;

  const get = (c: LocalCtx, corner: Corner): Local => store.get().values[key(c, corner)] ?? EMPTY;

  const payload = (c: LocalCtx): ScoreEntry[] =>
    c.corners.map((corner) => {
      const L = get(c, corner);
      return { corner, deductions: { ...L.ded }, items: { ...L.items } };
    });

  function scheduleSave(c: LocalCtx) {
    pending = c;
    if (timer != null) o.clearTimer(timer);
    timer = o.setTimer(() => {
      timer = null;
      const p = pending;
      pending = null;
      if (p && o.canSave()) o.save(p.gameId, p.formNo, payload(p)).catch(() => { /* the final send carries everything */ });
    }, o.debounceMs ?? 600);
  }

  function put(c: LocalCtx, corner: Corner, L: Local) {
    store.set((s) => ({ values: { ...s.values, [key(c, corner)]: L } }));
    scheduleSave(c);
  }

  return {
    store,
    get,
    payload,
    tap(c: LocalCtx, corner: Corner, code: string) {
      const L = get(c, corner);
      put(c, corner, { ...L, ded: { ...L.ded, [code]: (L.ded[code] ?? 0) + 1 } });
    },
    undo(c: LocalCtx, corner: Corner, code: string) {
      const L = get(c, corner);
      const n = L.ded[code] ?? 0;
      if (n <= 0) return;
      put(c, corner, { ...L, ded: { ...L.ded, [code]: n - 1 } });
    },
    setItems(c: LocalCtx, corner: Corner, items: Record<string, number>) {
      const L = get(c, corner);
      put(c, corner, { ...L, items: { ...L.items, ...items } });
    },
    /** Fill from the server draft (after a restart). Once per form; never over values already tapped here. */
    restore(c: LocalCtx, draft: ScoreEntry[] | undefined) {
      const fk = formKey(c);
      if (restored.has(fk)) return;
      restored.add(fk);
      if (!draft?.length) return;
      store.set((s) => {
        const values = { ...s.values };
        for (const d of draft) {
          const k = key(c, d.corner);
          if (!values[k]) values[k] = { ded: { ...(d.deductions ?? {}) }, items: { ...(d.items ?? {}) } };
        }
        return { values };
      });
    },
    /** Another official or ring: forget everything. */
    clear() {
      if (timer != null) o.clearTimer(timer);
      timer = null;
      pending = null;
      restored.clear();
      store.set({ values: {} });
    },
  };
}

export type JudgeLocal = ReturnType<typeof createJudgeLocal>;
