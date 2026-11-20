import { useEffect, useRef, useState } from 'react';
import type { Side } from '@/core/types';
import { api, useScoring } from '@/data';
import { isFreestyle } from '@/sports/poomsae/rules';
import { accuracyTenths, activeTaps, partialTenths, presentationTenths, tapCounts, technicalTenths, toPoints } from '@/sports/poomsae/scoring';
import type { SendState } from '@/ui/scoring';

/** Everything a judge scoring screen needs, derived from the live snapshot. */
export function useJudge() {
  const s = useScoring();
  const judgeNo = s.me?.judgeNo ?? 0;
  const cur = s.current;
  const sides: Side[] = cur?.format === 'PK' ? ['chung', 'hong'] : ['chung'];

  const side = (sd: Side) => {
    const taps = activeTaps(s.myEvents, judgeNo, sd);
    const crit = s.myDraft.criteria[sd];
    // Freestyle: "accuracy" is the technical-skills sum; Recognized: 4.0 minus tapped deductions.
    const accT = isFreestyle(s.rules) ? (technicalTenths(s.rules, crit) ?? partialTenths(s.rules, crit, 'TECHNICAL')) : accuracyTenths(s.rules, taps);
    const presT = presentationTenths(s.rules, crit);
    const counts = tapCounts(s.rules, taps);
    const last = taps[taps.length - 1];
    const lastAmount = last ? s.rules.deductions.find((d) => d.code === last.deductionCode)?.tenths ?? null : null;
    return {
      accuracy: toPoints(accT)!,
      accT,
      presentation: toPoints(presT),
      presentationSoFar: partialTenths(s.rules, crit, 'PRESENTATION') / 10,
      total: presT == null ? null : (accT + presT) / 10,
      criteria: s.myDraft.criteria[sd],
      minor: counts.ACC_01 ?? 0,
      major: counts.ACC_03 ?? 0,
      lastUndoLabel: lastAmount != null ? `−${(lastAmount / 10).toFixed(1)}` : null,
    };
  };

  const chung = side('chung');
  const hong = side('hong');
  const complete = sides.every((sd) => (sd === 'chung' ? chung : hong).total != null);
  const locked = s.myDraft.sendState === 'sent' || s.myDraft.sendState === 'sending' || cur?.status !== 'OPEN';

  // Two-tap confirm with a 4-second timeout back to ready.
  // Armed only for the exact scores it was armed on: any tap or criterion change disarms it.
  const sig = `${s.myEvents.length}|${JSON.stringify(s.myDraft.criteria)}`;
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const armed = armedFor === sig;
  const setArmed = (on: boolean) => setArmedFor(on ? sig : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const sendState: SendState =
    s.myDraft.sendState === 'sent' ? 'sent'
      : s.myDraft.sendState === 'sending' ? 'sending'
        : s.myDraft.sendState === 'failed' ? 'failed'
          : !complete ? 'incomplete' : armed ? 'confirm' : 'ready';

  async function pressSend() {
    if (sendState === 'ready') {
      setArmed(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (sendState === 'confirm' || sendState === 'failed') {
      setArmed(false);
      await api.submit();
    }
  }

  const correction = s.correction && s.correction.judgeNo === judgeNo ? s.correction : null;
  return { s, cur, judgeNo, sides, correction, chung, hong, complete, locked, sendState, pressSend, setArmed };
}

export function receiptTime(iso: string | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
