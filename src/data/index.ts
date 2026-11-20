import { useSyncExternalStore } from 'react';
import type { ScoringApi, ScoringSnapshot } from './ScoringApi';
import { MockScoringApi } from './mock/MockScoringApi';
import { HttpScoringApi } from './http/HttpScoringApi';

// Set EXPO_PUBLIC_API_MODE=http and EXPO_PUBLIC_API_URL=https://… once the backend is ready.
const mode = process.env.EXPO_PUBLIC_API_MODE === 'http' ? 'http' : 'mock';

export const api: ScoringApi =
  mode === 'http' ? new HttpScoringApi(process.env.EXPO_PUBLIC_API_URL ?? '') : new MockScoringApi();

/** Live snapshot of the scoring state; re-renders on every server update. */
export function useScoring(): ScoringSnapshot {
  return useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
}

export type { ScoringSnapshot } from './ScoringApi';
