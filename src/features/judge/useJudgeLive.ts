// Feeds the judge screens from the live stores: ring state, sheet, local taps, outbox.
import { useEffect, useState } from 'react';
import type { Corner } from '@/api/types';
import { judgeLocal, loadSheet, outbox, outboxNotice, poller, retrySheet, sheetKey, sheets, useLive, useOutbox, useSession, useTexts } from '@/live';
import type { LocalCtx } from '@/live/judgeLocal';
import { buildJudgeView } from '@/live/judgeView';
import { useStore } from '@/live/useStore';
import { makeModel, type JudgeModel } from './model';

export function useJudgeLive(): JudgeModel {
  const sess = useSession();
  const live = useLive();
  const box = useOutbox();
  const note = useStore(outboxNotice);
  const tx = useTexts();
  const sh = useStore(sheets);
  useStore(judgeLocal.store);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const p = sess.profile;
  const cur = live.state?.current ?? null;
  const ring = p?.ring ?? null;
  const gameId = cur?.gameId ?? null;
  const formNo = cur?.formNo ?? null;
  const method = cur?.method ?? null;
  const hasDraft = !!cur?.my?.draft;
  const lang = tx.lang;
  const ctx: LocalCtx | null = cur && ring
    ? { ring, gameId: cur.gameId, formNo: cur.formNo ?? 1, corners: cur.athletes.map((a) => a.corner) }
    : null;
  const key = gameId ? sheetKey(gameId, formNo) : null;
  const raw = key ? sh.byKey[key] : undefined;

  useEffect(() => {
    if (gameId && method === 'APP') loadSheet(gameId, formNo);
  }, [gameId, formNo, method, lang]);

  useEffect(() => {
    if (raw !== null || !key || !gameId) return;
    const t = setTimeout(() => { retrySheet(key); loadSheet(gameId, formNo); }, 3000);
    return () => clearTimeout(t);
  }, [raw, key, gameId, formNo]);

  // Restore only when the form or the presence of a saved draft changes, not on every poll.
  const cornerKey = cur ? cur.athletes.map((a) => a.corner).join(',') : '';
  useEffect(() => {
    if (!ring || !gameId) return;
    const draft = poller.store.get().state?.current?.my?.draft;
    judgeLocal.restore({ ring, gameId, formNo: formNo ?? 1, corners: cornerKey.split(',').filter(Boolean) as Corner[] }, draft);
  }, [ring, gameId, formNo, cornerKey, hasDraft]);

  const sheet = raw && raw !== 'loading' ? raw : null;
  const queued = !!ctx && box.jobs.some((j) => j.ring === ctx.ring && j.gameId === ctx.gameId && j.formNo === ctx.formNo);
  const view = buildJudgeView({
    state: live.state,
    seat: p?.seat ?? null,
    conn: live.conn,
    sheet,
    local: (corner: Corner) => (ctx ? judgeLocal.get(ctx, corner) : { ded: {}, items: {} }),
    queued,
    lastEvent: note.last,
    sinceRecvMs: Math.max(0, now - live.stateAt),
  });

  return makeModel({
    view,
    sheet,
    local: judgeLocal,
    ctx,
    confirming,
    setConfirming,
    onSend: () => {
      if (!ctx || !p) return;
      void outbox
        .add({ ring: ctx.ring, gameId: ctx.gameId, formNo: ctx.formNo, scores: judgeLocal.payload(ctx), officialId: p.officialId })
        .then(() => poller.pollNow());
    },
  });
}
