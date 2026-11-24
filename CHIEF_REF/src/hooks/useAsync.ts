import { useEffect, useState } from 'react';

export interface Async<T> {
  data?: T;
  error?: string;
  reload: () => void;
}

/** Loads data when `deps` change, optionally re-polling every `pollMs`. Stale responses are ignored. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[], pollMs?: number): Async<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    const run = () =>
      load().then(
        (result) => {
          if (!live) return;
          setData(result);
          setError(undefined);
        },
        (err: Error) => {
          if (live) setError(err.message);
        },
      );
    setData(undefined);
    setError(undefined);
    run();
    const timer = pollMs ? setInterval(run, pollMs) : undefined;
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [...deps, attempt]);

  return { data, error, reload: () => setAttempt((n) => n + 1) };
}
