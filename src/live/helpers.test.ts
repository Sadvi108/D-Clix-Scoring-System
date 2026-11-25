import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memoryKV } from './kv';
import { createStore } from './store';
import { uuid } from './uuid';

test('memoryKV stores, reads and removes', async () => {
  const kv = memoryKV({ a: '1' });
  assert.equal(await kv.get('a'), '1');
  await kv.set('b', '2');
  assert.equal(await kv.get('b'), '2');
  await kv.remove('a');
  assert.equal(await kv.get('a'), null);
  assert.deepEqual(kv.dump(), { b: '2' });
});

test('store merges patches and notifies subscribers', () => {
  const s = createStore({ n: 1, m: 'x' });
  let calls = 0;
  const off = s.subscribe(() => calls++);
  s.set({ n: 2 });
  s.set((st) => ({ m: st.m + 'y' }));
  assert.deepEqual(s.get(), { n: 2, m: 'xy' });
  assert.equal(calls, 2);
  off();
  s.set({ n: 3 });
  assert.equal(calls, 2);
});

test('uuid looks like a v4 uuid and differs each time', () => {
  const a = uuid();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, uuid());
});
