// Screen texts from the server (English and the languages it offers, e.g. Malay), cached on the
// tablet with their version. The app keeps its own English text as the last fallback.
import type { Endpoints } from '../api/endpoints';
import type { Language } from '../api/types';
import type { KV } from './kv';
import { createStore } from './store';

const LANG = 'dclix.lang';
const cacheKey = (lang: string) => `dclix.texts.${lang}`;
const EN: Language = { code: 'en', name: 'English', native: 'English', isDefault: true };

export function createTexts(o: { api: Pick<Endpoints, 'languages' | 'texts'>; kv: KV }) {
  const store = createStore<{ lang: string; languages: Language[]; dict: Record<string, string>; en: Record<string, string> }>({
    lang: 'en', languages: [EN], dict: {}, en: {},
  });

  async function fetchLang(lang: string): Promise<Record<string, string>> {
    const raw = await o.kv.get(cacheKey(lang));
    const cached = raw ? (JSON.parse(raw) as { version: number; texts: Record<string, string> }) : null;
    try {
      const d = await o.api.texts(lang, cached?.version);
      if (d.changed && d.texts) {
        await o.kv.set(cacheKey(lang), JSON.stringify({ version: d.version, texts: d.texts }));
        return d.texts;
      }
    } catch { /* offline: use the cache */ }
    return cached?.texts ?? {};
  }

  async function setLang(lang: string) {
    await o.kv.set(LANG, lang);
    const dict = await fetchLang(lang);
    store.set({ lang, dict });
  }

  async function init(preferred?: string) {
    let languages = [EN];
    try {
      const l = await o.api.languages();
      if (l.languages.length) languages = l.languages;
    } catch { /* server down: English only */ }
    const want = (await o.kv.get(LANG)) ?? preferred ?? 'en';
    const lang = languages.some((l) => l.code === want) ? want : 'en';
    const en = await fetchLang('en');
    const dict = lang === 'en' ? en : await fetchLang(lang);
    store.set({ lang, languages, dict, en });
  }

  /** Server text for `key`, else the English server text, else `fallback`. `{name}` placeholders are filled from params. */
  function t(key: string, fallback: string, params?: Record<string, string | number>) {
    const { dict, en } = store.get();
    let s = dict[key] ?? en[key] ?? fallback;
    if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }

  return { store, init, setLang, t, lang: () => store.get().lang };
}

export type TextsService = ReturnType<typeof createTexts>;
