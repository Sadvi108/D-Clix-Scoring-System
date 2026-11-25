import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../api/client';
import type { Languages, Texts } from '../api/types';
import { memoryKV } from './kv';
import { createTexts } from './texts';

const langs: Languages = { version: 3, languages: [
  { code: 'en', name: 'English', native: 'English', isDefault: true },
  { code: 'ms', name: 'Malay', native: 'Bahasa Melayu', isDefault: false },
] };

function api(texts: Record<string, Texts>, asked: string[] = []) {
  return {
    languages: async () => langs,
    texts: async (lang: string, version?: number) => { asked.push(`${lang}:${version ?? ''}`); return texts[lang]; },
  };
}

test('t() uses the server text, falls back to English then to the given text, and fills params', async () => {
  const t = createTexts({ api: api({
    en: { lang: 'en', version: 1, changed: true, texts: { hello: 'Hello {name}', only_en: 'Only EN' } },
    ms: { lang: 'ms', version: 2, changed: true, texts: { hello: 'Helo {name}' } },
  }), kv: memoryKV() });
  await t.init('ms');
  assert.equal(t.t('hello', 'Hi', { name: 'Sara' }), 'Helo Sara');
  assert.equal(t.t('only_en', 'x'), 'Only EN');
  assert.equal(t.t('missing', 'Fallback'), 'Fallback');
  assert.equal(t.store.get().languages.length, 2);
});

test('cached texts are used and the stored version is sent', async () => {
  const kv = memoryKV({ 'dclix.texts.en': JSON.stringify({ version: 7, texts: { a: 'Cached' } }) });
  const asked: string[] = [];
  const t = createTexts({ api: api({ en: { lang: 'en', version: 7, changed: false } }, asked), kv });
  await t.init('en');
  assert.deepEqual(asked, ['en:7']);
  assert.equal(t.t('a', 'x'), 'Cached');
});

test('server down: English only, texts from the app', async () => {
  const t = createTexts({ api: { languages: async () => { throw new ApiError('OFFLINE', 'x'); }, texts: async () => { throw new ApiError('OFFLINE', 'x'); } }, kv: memoryKV() });
  await t.init('ms');
  assert.equal(t.store.get().lang, 'en');
  assert.equal(t.t('k', 'App text'), 'App text');
});

test('setLang stores the choice', async () => {
  const kv = memoryKV();
  const t = createTexts({ api: api({ en: { lang: 'en', version: 1, changed: true, texts: {} }, ms: { lang: 'ms', version: 1, changed: true, texts: { k: 'Melayu' } } }), kv });
  await t.init();
  await t.setLang('ms');
  assert.equal(await kv.get('dclix.lang'), 'ms');
  assert.equal(t.t('k', 'x'), 'Melayu');
});

test('corrupt cached texts are treated as no cache (init and setLang do not reject)', async () => {
  const kv = memoryKV({ 'dclix.texts.en': '{bad', 'dclix.texts.ms': 'null' });
  const asked: string[] = [];
  const t = createTexts({ api: api({
    en: { lang: 'en', version: 1, changed: true, texts: { a: 'Fresh' } },
    ms: { lang: 'ms', version: 2, changed: true, texts: { a: 'Baru' } },
  }, asked), kv });
  await t.init('en');
  assert.equal(t.t('a', 'x'), 'Fresh');
  assert.deepEqual(asked, ['en:']);
  await t.setLang('ms');
  assert.equal(t.t('a', 'x'), 'Baru');

  // server down as well: still no throw, app text is used
  const down = createTexts({ api: { languages: async () => { throw new ApiError('OFFLINE', 'x'); }, texts: async () => { throw new ApiError('OFFLINE', 'x'); } }, kv: memoryKV({ 'dclix.texts.en': '{bad' }) });
  await down.init();
  await down.setLang('en');
  assert.equal(down.t('k', 'App text'), 'App text');
});
