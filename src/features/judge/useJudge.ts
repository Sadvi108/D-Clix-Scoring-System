import { useState } from 'react';
import type { Side } from '@/core/types';
import { api, useScoring } from '@/data';
import { isFreestyle } from '@/sports/poomsae/rules';
import { accuracyTenths, activeTaps, deductionTenths, partialTenths, presentationTenths, tapCounts, technicalTenths, toPoints } from '@/sports/poomsae/scoring';
import type { SendState } from '@/ui/scoring';

/** Everything a judge scoring screen needs, derived from the live snapshot. */
export function useJudge() {
  const s = useScoring();
  const [confirming, setConfirming] = useState(false);
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
    // Freestyle: tapped deductions come off the total. Recognized: they are already inside accuracy.
    const dedT = isFreestyle(s.rules) ? deductionTenths(s.rules, taps) : 0;
    return {
      accuracy: toPoints(accT)!,
      accT,
      presentation: toPoints(presT),
      presentationSoFar: partialTenths(s.rules, crit, 'PRESENTATION') / 10,
      deduction: dedT / 10,
      dedT,
      total: presT == null ? null : Math.max(0, accT + presT - dedT) / 10,
      criteria: s.myDraft.criteria[sd],
      minor: counts.ACC_01 ?? 0,
      major: counts.ACC_03 ?? 0,
      canUndo: taps.length > 0,
    };
  };

  const chung = side('chung');
  const hong = side('hong');
  const complete = sides.every((sd) => (sd === 'chung' ? chung : hong).total != null);
  const paused = !!cur?.paused;
  const stopped = !!cur?.stopReason;
  // Called / on the mat, or scoring open but the operator has not started the form yet.
  const waiting = !!cur && (cur.status === 'CALLED' || cur.status === 'ON_MAT' || (cur.status === 'OPEN' && !paused && !stopped && !cur.clockRunning && cur.clockSec === 0));
  const locked = s.myDraft.sendState === 'sent' || s.myDraft.sendState === 'sending' || cur?.status !== 'OPEN' || paused || waiting;

  // Send asks for confirmation first; once sent the score is locked (only the chief referee can reopen it).
  const sendState: SendState =
    s.myDraft.sendState === 'sent' ? 'sent'
      : s.myDraft.sendState === 'sending' ? 'sending'
        : paused ? 'paused'
          : waiting ? 'waiting'
          : s.myDraft.sendState === 'failed' ? 'failed'
            : !complete ? 'incomplete' : 'ready';

  /** Send button / Enter key: opens the confirmation. */
  function pressSend() {
    if (sendState === 'ready' || sendState === 'failed') setConfirming(true);
  }
  async function confirmSend() {
    setConfirming(false);
    if (sendState === 'ready' || sendState === 'failed') return api.submit();
    return null;
  }
  const cancelSend = () => setConfirming(false);

  const correction = s.correction && s.correction.judgeNo === judgeNo ? s.correction : null;
    // One line under the match bar telling the judge why the screen is locked.
  const notice: { icon: 'clock' | 'pause' | 'check'; text: string } | null =
    paused ? { icon: 'pause', text: 'Paused by the operator. Scoring is locked.' }
      : stopped && cur?.status === 'OPEN' && s.myDraft.sendState !== 'sent' ? { icon: 'clock', text: `Game stopped: ${cur.stopReason}. You can still finish and send your score.` }
      : waiting ? { icon: 'clock', text: 'Waiting for the operator to start…' }
        : s.myDraft.sendState === 'sent' && cur?.status !== 'RELEASED' ? { icon: 'check', text: 'Sent. Waiting for the other referees and the operator.' }
          : null;

  return { s, cur, judgeNo, sides, correction, chung, hong, complete, locked, paused, waiting, notice, sendState, pressSend, confirming, confirmSend, cancelSend };
}

export function receiptTime(iso: string | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
