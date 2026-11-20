import { useSyncExternalStore } from 'react';
import { getDeviceSettings, loadDeviceSettings } from '@/device/settings';
import type { ScoringApi, ScoringSnapshot } from './ScoringApi';
import { MockScoringApi } from './mock/MockScoringApi';
import { HttpScoringApi } from './http/HttpScoringApi';

// Set EXPO_PUBLIC_API_MODE=http and EXPO_PUBLIC_API_URL=https://… once the backend is ready.
const mode = process.env.EXPO_PUBLIC_API_MODE === 'http' ? 'http' : 'mock';

export const apiMode = mode;

const http = mode === 'http' ? new HttpScoringApi(process.env.EXPO_PUBLIC_API_URL ?? '') : null;
export const api: ScoringApi = http ?? new MockScoringApi();

// The server address saved on this tablet (wired LAN or Wi-Fi) wins over the build-time default.
loadDeviceSettings().then(() => { const u = getDeviceSettings().serverUrl; if (http && u) http.setBaseUrl(u); });
export function applyServerUrl(url: string) {
  if (http && url) http.setBaseUrl(url);
}

/** Live snapshot of the scoring state; re-renders on every server update. */
export function useScoring(): ScoringSnapshot {
  return useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
}

export type { ScoringSnapshot } from './ScoringApi';
