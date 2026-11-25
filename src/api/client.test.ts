import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, createClient, type FetchLike } from './client';

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(reply: { status: number; json?: unknown; throws?: boolean; badJson?: boolean }) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body });
    if (reply.throws) throw new TypeError('Network request failed');
    return {
      status: reply.status,
      json: async () => {
        if (reply.badJson) throw new SyntaxError('Unexpected token');
        return reply.json;
      },
    };
  };
  return { fetch, calls };
}

function client(fetch: FetchLike, token: string | null = 'tok-1') {
  return createClient({ fetch, baseUrl: () => 'https://srv/api/v1/', token: () => token, lang: () => 'ms', appVersion: '1.2.0' });
}

test('GET unwraps data and sends the standard headers', async () => {
  const f = fakeFetch({ status: 200, json: { ok: true, data: { name: 'A' }, serverTime: 'x' } });
  const out = await client(f.fetch)<{ name: string }>('GET', '/me');
  assert.deepEqual(out, { name: 'A' });
  assert.equal(f.calls[0].url, 'https://srv/api/v1/me');
  assert.equal(f.calls[0].method, 'GET');
  assert.equal(f.calls[0].headers.Authorization, 'Bearer tok-1');
  assert.equal(f.calls[0].headers['Accept-Language'], 'ms');
  assert.equal(f.calls[0].headers['X-App-Version'], '1.2.0');
  assert.equal(f.calls[0].body, undefined);
});

test('no Authorization header without a token', async () => {
  const f = fakeFetch({ status: 200, json: { ok: true, data: {} } });
  await client(f.fetch, null)('GET', '/languages');
  assert.equal(f.calls[0].headers.Authorization, undefined);
});

test('POST sends a JSON body', async () => {
  const f = fakeFetch({ status: 200, json: { ok: true, data: { saved: true } } });
  await client(f.fetch)('POST', '/seat/claim', { ring: 'A' });
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].headers['Content-Type'], 'application/json');
  assert.equal(f.calls[0].body, '{"ring":"A"}');
});

test('PUT goes out as POST with the method override header', async () => {
  const f = fakeFetch({ status: 200, json: { ok: true, data: {} } });
  await client(f.fetch)('PUT', '/ring/display', { mode: 'RESULT' });
  assert.equal(f.calls[0].method, 'POST');
  assert.equal(f.calls[0].headers['X-HTTP-Method-Override'], 'PUT');
});

test('an error reply becomes ApiError with code, message, params and status', async () => {
  const f = fakeFetch({ status: 409, json: { ok: false, error: { code: 'DEVICE_IN_USE', message: 'In use', params: { deviceLabel: 'Tab 2' } } } });
  await assert.rejects(client(f.fetch)('POST', '/auth/login', {}), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.code, 'DEVICE_IN_USE');
    assert.equal(e.message, 'In use');
    assert.equal(e.http, 409);
    assert.deepEqual(e.params, { deviceLabel: 'Tab 2' });
    return true;
  });
});

test('a network failure becomes OFFLINE', async () => {
  const f = fakeFetch({ status: 0, throws: true });
  await assert.rejects(client(f.fetch)('GET', '/me'), (e: unknown) => e instanceof ApiError && e.code === 'OFFLINE');
});

test('a reply that is not JSON becomes SERVER_ERROR with the status', async () => {
  const f = fakeFetch({ status: 502, badJson: true });
  await assert.rejects(client(f.fetch)('GET', '/me'), (e: unknown) => e instanceof ApiError && e.code === 'SERVER_ERROR' && e.http === 502);
});
