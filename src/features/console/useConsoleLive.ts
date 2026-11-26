// Feeds the operator and chief console from the live stores: ring state, game review, and one guarded action runner.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import type { Review } from '@/api/types';
import { api, poller, session, useLive, useSession } from '@/live';
import { buildConsoleView, needsReview, type ConsoleView } from '@/live/consoleView';

/** `done` is the notice after success: text, or a function of what the action returned. */
export type RunFn = (label: string, fn: () => Promise<unknown>, done?: string | ((result: unknown) => string)) => Promise<void>;

export interface ConsoleModel {
  view: ConsoleView;
  run: RunFn;
  busy: boolean;
  error: string | null;
  notice: string | null;
  clearMessages: () => void;
  reloadReview: () => void;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useConsoleLive(): ConsoleModel {
  const sess = useSession();
  const live = useLive();
  const [now, setNow] = useState(() => Date.now());
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const busyRef = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const cur = live.state?.current ?? null;
  const gameId = cur?.gameId ?? null;
  const stage = cur?.stage ?? '';
  const version = live.state?.version ?? 0;
  const wantReview = !!cur && cur.method === 'APP' && needsReview(cur);

  useEffect(() => {
    if (!gameId || !wantReview) return;
    let alive = true;
    api.review(gameId).then(
      (r) => { if (alive) setReview(r); },
      (e) => {
        if (!alive) return;
        if (e instanceof ApiError && e.code === 'PANEL_INCOMPLETE') { setReview(null); return; }
        setReview(null);
        if (!session.handleError(e)) setError(msg(e));
      },
    );
    return () => { alive = false; };
  }, [gameId, version, stage, wantReview, tick]);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const run: RunFn = useCallback(async (label, fn, done) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      showNotice(typeof done === 'function' ? done(result) : done ?? `${label} done`);
      void poller.pollNow();
      setTick((n) => n + 1);
    } catch (e) {
      if (!session.handleError(e)) setError(msg(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [showNotice]);

  const view = buildConsoleView({
    state: live.state,
    review: wantReview && review?.gameId === gameId ? review : null,
    role: sess.profile?.role ?? 'OPERATOR',
    conn: live.conn,
    sinceRecvMs: Math.max(0, now - live.stateAt),
  });

  return {
    view,
    run,
    busy,
    error,
    notice,
    clearMessages: () => { setError(null); setNotice(null); },
    reloadReview: () => setTick((n) => n + 1),
  };
}
