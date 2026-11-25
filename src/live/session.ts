// Who is signed in on this tablet. The token and profile survive app restarts; an expired or
// moved session (AUTH_REQUIRED, TOKEN_EXPIRED, RESEATED) signs the tablet out with the reason.
import { ApiError } from '../api/client';
import type { Endpoints } from '../api/endpoints';
import type { DeviceInfo, Profile } from '../api/types';
import type { KV } from './kv';
import { createStore } from './store';

export type SessionApi = Pick<Endpoints, 'login' | 'logout' | 'me' | 'claimSeat'>;
export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';
export interface SessionState { status: SessionStatus; token: string | null; profile: Profile | null; message: string }
export type LoginResult =
  | { kind: 'ok'; profile: Profile }
  | { kind: 'takeover'; deviceLabel: string }
  | { kind: 'error'; code: string; message: string };

const TOKEN = 'dclix.token';
const PROFILE = 'dclix.profile';
export const AUTH_CODES = ['AUTH_REQUIRED', 'TOKEN_EXPIRED', 'RESEATED'];

export function createSession(o: { api: SessionApi; kv: KV; device: () => Promise<DeviceInfo>; lang: () => string }) {
  const store = createStore<SessionState>({ status: 'booting', token: null, profile: null, message: '' });

  async function save(token: string | null, profile: Profile | null) {
    if (token) await o.kv.set(TOKEN, token); else await o.kv.remove(TOKEN);
    if (profile) await o.kv.set(PROFILE, JSON.stringify(profile)); else await o.kv.remove(PROFILE);
  }

  function signOutLocal(message = '') {
    store.set({ status: 'signedOut', token: null, profile: null, message });
    save(null, null).catch(() => {});
  }

  async function boot() {
    const token = await o.kv.get(TOKEN);
    if (!token) { store.set({ status: 'signedOut' }); return; }
    store.set({ token });
    try {
      const profile = await o.api.me();
      await save(token, profile);
      store.set({ status: 'signedIn', profile, message: '' });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'OFFLINE') {
        const raw = await o.kv.get(PROFILE);
        const cached = raw ? (JSON.parse(raw) as Profile) : null;
        if (cached) { store.set({ status: 'signedIn', profile: cached }); return; }
      }
      signOutLocal(e instanceof ApiError && AUTH_CODES.includes(e.code) ? e.message : '');
    }
  }

  async function login(pin: string, confirmReplace = false): Promise<LoginResult> {
    try {
      const data = await o.api.login({ pin, device: await o.device(), lang: o.lang(), confirmReplace });
      await save(data.token, data.profile);
      store.set({ status: 'signedIn', token: data.token, profile: data.profile, message: '' });
      return { kind: 'ok', profile: data.profile };
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DEVICE_IN_USE') {
        return { kind: 'takeover', deviceLabel: String(e.params.deviceLabel ?? 'another device') };
      }
      const err = e instanceof ApiError ? e : new ApiError('SERVER_ERROR', String(e));
      return { kind: 'error', code: err.code, message: err.message };
    }
  }

  /** Take a ring (and seat for a judge). Throws ApiError (SEAT_TAKEN, OPERATOR_TAKEN, SWITCH_BLOCKED…). */
  async function claim(ring: string, seat?: number): Promise<Profile> {
    await o.api.claimSeat(ring, seat);
    const profile = await o.api.me();
    await save(store.get().token, profile);
    store.set({ profile });
    return profile;
  }

  async function logout() {
    try { await o.api.logout(); } catch { /* sign out locally anyway */ }
    signOutLocal('');
  }

  /** Call with any API error: signs out on an auth code and reports whether it did. */
  function handleError(e: unknown): boolean {
    if (e instanceof ApiError && AUTH_CODES.includes(e.code)) { signOutLocal(e.message); return true; }
    return false;
  }

  return { store, boot, login, claim, logout, handleError, token: () => store.get().token };
}

export type Session = ReturnType<typeof createSession>;
