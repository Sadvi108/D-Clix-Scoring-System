// Provisional figures on the judge screen, computed from the sheet the server sends (same rules
// as the web app). The server recomputes everything on send; its figures are the official ones.
import type { Sheet } from '../api/types';

/** What the judge has tapped for one athlete: count per deduction key, value per item. */
export interface Local { ded: Record<string, number>; items: Record<string, number> }

export interface Calc {
  /** First part after deductions (accuracy, or technical for Freestyle). */
  acc: number;
  /** Presentation after deductions. */
  pres: number;
  tot: number;
  /** Every item of both sections has a value. */
  ok: boolean;
  dec: number;
  /** All deductions together. */
  ded: number;
  techSum: number;
  presSum: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function calc(sheet: Sheet, L: Local): Calc {
  const [first, presSec] = sheet.sections;
  const tech = first.items ?? [];
  const dec = sheet.total.decimals ?? 1;
  let dA = 0;
  let dP = 0;
  let dT = 0;
  let techSum = 0;
  let presSum = 0;
  let ok = true;

  for (const k of first.keys) {
    const d = (L.ded[k.code] ?? 0) * Math.abs(k.value);
    if (k.target === 'PRESENTATION') dP += d;
    else if (k.target === 'TOTAL') dT += d;
    else dA += d;
  }
  for (const i of tech) {
    const v = L.items[i.code];
    if (v == null) ok = false; else techSum += v;
  }
  for (const i of presSec.items) {
    const v = L.items[i.code];
    if (v == null) ok = false; else presSum += v;
  }

  let acc = Math.max(0, r2((tech.length ? techSum : first.max) - dA));
  let pres = Math.max(0, r2(presSum - dP));
  // A TOTAL deduction comes off presentation first, then off the first part.
  const fromPres = Math.min(pres, dT);
  pres = r2(pres - fromPres);
  acc = Math.max(0, r2(acc - (dT - fromPres)));

  return { acc, pres, tot: r2(acc + pres), ok, dec, ded: r2(dA + dP + dT), techSum: r2(techSum), presSum: r2(presSum) };
}

/** Number of items still unset across all athletes of the game. */
export function missingItems(sheet: Sheet, locals: Local[]): number {
  const all = [...(sheet.sections[0].items ?? []), ...sheet.sections[1].items];
  return locals.reduce((n, L) => n + all.filter((i) => L.items[i.code] == null).length, 0);
}
