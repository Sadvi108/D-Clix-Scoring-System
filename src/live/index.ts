// The live services the screens use, wired to fetch, AsyncStorage and this device.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createClient, type FetchLike } from '@/api/client';
import { makeEndpoints } from '@/api/endpoints';
import type { DeviceInfo, Sheet } from '@/api/types';
import { getDeviceSettings } from '@/device/settings';
import { createJudgeLocal } from './judgeLocal';
import { asyncStorageKV } from './kvAsync';
import { createOutbox, type OutboxEvent } from './outbox';
import { createRingPoller } from './ringState';
import { createSession } from './session';
import { createStore } from './store';
import { createTexts } from './texts';
import { useStore } from './useStore';
import { uuid } from './uuid';

/** UAT server; a tablet can change it on the Device connection screen. */
export const UAT_URL = 'https://www.maclubsystem.com/Competitionuat/api/v1';
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
export const PLATFORM: DeviceInfo['platform'] = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android';

export const baseUrl = () => getDeviceSettings().serverUrl || process.env.EXPO_PUBLIC_API_URL || UAT_URL;

let sessionToken: () => string | null = () => null;
let currentLang: () => string = () => 'en';

const request = createClient({
  fetch: fetch as unknown as FetchLike,
  baseUrl,
  token: () => sessionToken(),
  lang: () => currentLang(),
  appVersion: APP_VERSION,
});
export const api = makeEndpoints(request);

export const texts = createTexts({ api, kv: asyncStorageKV });
currentLang = () => texts.lang();

async function device(): Promise<DeviceInfo> {
  let id = await asyncStorageKV.get('dclix.device.id');
  if (!id) { id = uuid(); await asyncStorageKV.set('dclix.device.id', id); }
  const name = (Constants as unknown as { deviceName?: string }).deviceName;
  return { id, label: (name || `${PLATFORM} tablet`).slice(0, 40), platform: PLATFORM, appVersion: APP_VERSION };
}

export const session = createSession({ api, kv: asyncStorageKV, device, lang: () => texts.lang() });
sessionToken = () => session.token();

/** Last outbox result, for the judge screen ("Sent" or why it was refused). */
export const outboxNotice = createStore<{ last: OutboxEvent | null }>({ last: null });

export const outbox = createOutbox({
  kv: asyncStorageKV,
  send: (job, offline) =>
    api.sendScores(job.gameId, { clientRequestId: job.id, formNo: job.formNo, scores: job.scores, ...(offline ? { offline: true, clientTime: job.clientTime } : {}) }),
  uuid,
  now: () => new Date(),
  onEvent: (e) => {
    outboxNotice.set({ last: e });
  },
  canSend: (job) => {
    const s = session.store.get();
    return s.status === 'signedIn' && !!s.token && (job.officialId == null || job.officialId === s.profile?.officialId);
  },
});

/** Asked by the poller when the server has no ring for this token. */
export const ringNeeded = createStore<{ needed: boolean }>({ needed: false });

/** After a successful claim: the poll key may be unchanged, so reset and poll at once. */
export function afterClaim() {
  ringNeeded.set({ needed: false });
  poller.stop();
  void poller.pollNow();
}

export const poller = createRingPoller({
  api,
  role: () => session.store.get().profile?.role ?? null,
  unsent: () => outbox.count(),
  onAuthError: (e) => session.handleError(e),
  onNoRing: () => ringNeeded.set({ needed: true }),
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
});

/** The judge's taps; saved as a draft only while the form is open, not yet sent, and the link is up. */
export const judgeLocal = createJudgeLocal({
  save: (gameId, formNo, scores) => api.saveDraft(gameId, formNo, scores),
  canSave: () => {
    const live = poller.store.get();
    const cur = live.state?.current;
    return live.conn && !!cur?.scoringOpen && !cur.my?.sent;
  },
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
});

/** Score sheets by ring|game|form|language: undefined = not asked, 'loading', null = failed (retried), or the sheet. */
export const sheets = createStore<{ byKey: Record<string, Sheet | null | 'loading'> }>({ byKey: {} });

export function sheetKey(gameId: string, formNo: number | null) {
  return `${session.store.get().profile?.ring ?? ''}|${gameId}|${formNo ?? 0}|${texts.lang()}`;
}

export function loadSheet(gameId: string, formNo: number | null) {
  const key = sheetKey(gameId, formNo);
  if (sheets.get().byKey[key] !== undefined) return;
  sheets.set((s) => ({ byKey: { ...s.byKey, [key]: 'loading' } }));
  api.sheet(gameId, formNo).then(
    (sheet) => sheets.set((s) => ({ byKey: { ...s.byKey, [key]: sheet } })),
    (e) => {
      session.handleError(e);
      sheets.set((s) => ({ byKey: { ...s.byKey, [key]: null } }));
    },
  );
}

/** Forget a failed sheet so the next loadSheet asks again. */
export function retrySheet(key: string) {
  sheets.set((s) => {
    const byKey = { ...s.byKey };
    delete byKey[key];
    return { byKey };
  });
}

let started = false;
/** Called once from the root layout. */
export function startLive() {
  if (started) return;
  started = true;
  void texts.init();
  void outbox.load().then(() => outbox.flush());

  // Poll while an official holds a ring; stop when signed out or ring-less.
  // Subscribe before boot() so the first signed-in state starts the poller.
  let pollingFor = '';
  let wasSignedIn = false;
  session.store.subscribe(() => {
    const signedIn = session.store.get().status === 'signedIn';
    if (signedIn && !wasSignedIn && outbox.count()) void outbox.flush();
    wasSignedIn = signedIn;
    const p = session.store.get().profile;
    const key = session.store.get().status === 'signedIn' && p?.ring ? `${p.officialId}|${p.ring}|${p.seat ?? ''}` : '';
    if (key === pollingFor) return;
    pollingFor = key;
    judgeLocal.clear();
    sheets.set({ byKey: {} });
    poller.stop();
    if (key) { ringNeeded.set({ needed: false }); void poller.pollNow(); }
  });
  void session.boot();

  // Retry queued score sends every 3 seconds, and as soon as the link comes back.
  setInterval(() => { if (outbox.count()) void outbox.flush(); }, 3000);
  let wasOnline = true;
  poller.store.subscribe(() => {
    const on = poller.store.get().conn;
    if (on && !wasOnline && outbox.count()) void outbox.flush();
    wasOnline = on;
  });
}

export const useSession = () => useStore(session.store);
export const useLive = () => useStore(poller.store);
export const useOutbox = () => useStore(outbox.store);
export const useTexts = () => useStore(texts.store);
export const useRingNeeded = () => useStore(ringNeeded);
