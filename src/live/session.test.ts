import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/client';
import type { DeviceInfo, LoginData, Profile } from '../api/types';
import { memoryKV } from './kv';
import { createSession, type SessionApi } from './session';

const profile = (p: Partial<Profile> = {}): Profile => ({
  officialId: 7, name: 'Sara', role: 'JUDGE', tournament: { id: 1, name: 'Open' }, ring: null, date: '2026-11-25', seat: null, language: 'en', ...p,
});
const device: DeviceInfo = { id: 'dev-1', label: 'ios tablet', platform: 'ios', appVersion: '1.2.0' };

function api(over: Partial<SessionApi> = {}): SessionApi {
  return {
    login: async () => ({ token: 't-1', expiresAt: 'x', profile: profile() } as LoginData),
    logout: async () => ({}),
    me: async () => profile(),
    claimSeat: async () => ({ ring: 'A', seat: 2, role: 'JUDGE' }),
    ...over,
  };
}

test('boot with no stored token ends signed out', async () => {
  const s = createSession({ api: api(), kv: memoryKV(), device: async () => device, lang: () => 'en' });
  await s.boot();
  assert.equal(s.store.get().status, 'signedOut');
});

test('boot with a token checks /me and signs in', async () => {
  const kv = memoryKV({ 'dclix.token': 't-9' });
  const s = createSession({ api: api({ me: async () => profile({ ring: 'A', seat: 2 }) }), kv, device: async () => device, lang: () => 'en' });
  await s.boot();
  assert.equal(s.store.get().status, 'signedIn');
  assert.equal(s.store.get().token, 't-9');
  assert.equal(s.store.get().profile?.ring, 'A');
});

test('boot offline keeps the stored profile', async () => {
  const kv = memoryKV({ 'dclix.token': 't-9', 'dclix.profile': JSON.stringify(profile({ ring: 'B', seat: 1 })) });
  const s = createSession({ api: api({ me: async () => { throw new ApiError('OFFLINE', 'No connection'); } }), kv, device: async () => device, lang: () => 'en' });
  await s.boot();
  assert.equal(s.store.get().status, 'signedIn');
  assert.equal(s.store.get().profile?.ring, 'B');
});

test('boot with an expired token signs out and clears storage', async () => {
  const kv = memoryKV({ 'dclix.token': 't-9' });
  const s = createSession({ api: api({ me: async () => { throw new ApiError('TOKEN_EXPIRED', 'Expired', 401); } }), kv, device: async () => device, lang: () => 'en' });
  await s.boot();
  assert.equal(s.store.get().status, 'signedOut');
  assert.equal(s.store.get().message, 'Expired');
  assert.equal(await kv.get('dclix.token'), null);
});

test('login stores token and profile', async () => {
  const kv = memoryKV();
  let sent: unknown;
  const s = createSession({ api: api({ login: async (b) => { sent = b; return { token: 't-1', expiresAt: 'x', profile: profile() }; } }), kv, device: async () => device, lang: () => 'ms' });
  const r = await s.login('123456');
  assert.equal(r.kind, 'ok');
  assert.deepEqual(sent, { pin: '123456', device, lang: 'ms', confirmReplace: false });
  assert.equal(s.store.get().status, 'signedIn');
  assert.equal(await kv.get('dclix.token'), 't-1');
});

test('login on a device already in use asks for takeover', async () => {
  const s = createSession({
    api: api({ login: async () => { throw new ApiError('DEVICE_IN_USE', 'In use', 409, { deviceLabel: 'Tab 2' }); } }),
    kv: memoryKV(), device: async () => device, lang: () => 'en',
  });
  await s.boot();
  const r = await s.login('123456');
  assert.deepEqual(r, { kind: 'takeover', deviceLabel: 'Tab 2' });
  assert.equal(s.store.get().status, 'signedOut');
});

test('login error returns the server message', async () => {
  const s = createSession({
    api: api({ login: async () => { throw new ApiError('VALIDATION_FAILED', 'Wrong PIN', 400); } }),
    kv: memoryKV(), device: async () => device, lang: () => 'en',
  });
  assert.deepEqual(await s.login('000000'), { kind: 'error', code: 'VALIDATION_FAILED', message: 'Wrong PIN' });
});

test('claim takes the seat and refreshes the profile', async () => {
  const kv = memoryKV();
  const s = createSession({ api: api({ me: async () => profile({ ring: 'A', seat: 2 }) }), kv, device: async () => device, lang: () => 'en' });
  await s.login('123456');
  const p = await s.claim('A', 2);
  assert.equal(p.seat, 2);
  assert.equal(JSON.parse((await kv.get('dclix.profile'))!).ring, 'A');
});

test('handleError signs out on auth codes only', async () => {
  const s = createSession({ api: api(), kv: memoryKV(), device: async () => device, lang: () => 'en' });
  await s.login('123456');
  assert.equal(s.handleError(new ApiError('WRONG_STAGE', 'x', 409)), false);
  assert.equal(s.store.get().status, 'signedIn');
  assert.equal(s.handleError(new ApiError('RESEATED', 'Moved to another device', 401)), true);
  assert.equal(s.store.get().status, 'signedOut');
  assert.equal(s.store.get().message, 'Moved to another device');
});

test('logout clears even when the server call fails', async () => {
  const kv = memoryKV();
  const s = createSession({ api: api({ logout: async () => { throw new ApiError('OFFLINE', 'x'); } }), kv, device: async () => device, lang: () => 'en' });
  await s.login('123456');
  await s.logout();
  assert.equal(s.store.get().status, 'signedOut');
  assert.equal(await kv.get('dclix.token'), null);
});
