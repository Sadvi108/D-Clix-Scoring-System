// Load now, then again `everyMs` after each reply (never two requests at once). `deps` restart it.
// Pauses while the screen is not in front (a screen left under another stays mounted).
// `everyMs: 0` loads once. The last good data stays while a later poll fails; sign-in errors sign out.
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { session } from './index';

export function usePolled<T>(load: () => Promise<T>, everyMs: number, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [tick, setTick] = useState(0);
  const focused = useIsFocused();
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    if (!focused) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      try {
        const d = await loadRef.current();
        if (!alive) return;
        setData(d); setError(null); setAt(Date.now());
      } catch (e) {
        if (!alive) return;
        // An expired or replaced sign-in signs the tablet out (the screens then go to sign-in).
        session.handleError(e);
        setError(e instanceof Error ? e.message : String(e));
      }
      if (alive && everyMs > 0) timer = setTimeout(run, everyMs);
    };
    void run();
    return () => { alive = false; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyMs, tick, focused, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, at, reload, setData };
}
