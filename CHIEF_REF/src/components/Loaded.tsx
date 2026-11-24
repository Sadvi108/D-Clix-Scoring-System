import type { ReactNode } from 'react';
import type { Async } from '../hooks/useAsync';

interface Props<T> {
  state: Async<T>;
  children: (data: T) => ReactNode;
}

export function Loaded<T>({ state, children }: Props<T>) {
  if (state.data !== undefined) return <>{children(state.data)}</>;
  if (state.error) {
    return (
      <div className="notice" role="alert">
        <span>Can't reach the server ({state.error}).</span>
        <button className="btn" onClick={state.reload}>Try again</button>
      </div>
    );
  }
  return <div className="notice" aria-busy="true">Loading…</div>;
}
