// Load now, then again `everyMs` after each reply (never two requests at once). `deps` restart it.
// `everyMs: 0` loads once. The last good data stays while a later poll fails.
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePolled<T>(load: () => Promise<T>, everyMs: number, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = async () => {
      try {
        const d = await loadRef.current();
        if (!alive) return;
        setData(d); setError(null); setAt(Date.now());
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      }
      if (alive && everyMs > 0) timer = setTimeout(run, everyMs);
    };
    void run();
    return () => { alive = false; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [everyMs, tick, ...deps]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, at, reload, setData };
}
