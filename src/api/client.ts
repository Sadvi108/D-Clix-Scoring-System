// One request function for the whole API. Sends the token, the language and the app version,
// unwraps {ok, data}, and turns every failure into ApiError with a code the app can act on.
import type { Envelope } from './types';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public http = 0,
    public params: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface ClientConfig {
  fetch: FetchLike;
  baseUrl: () => string;
  token: () => string | null;
  lang: () => string;
  appVersion: string;
  timeoutMs?: number;
}

export type Method = 'GET' | 'POST' | 'PUT';
export type Request = <T>(method: Method, path: string, body?: unknown) => Promise<T>;

export function createClient(cfg: ClientConfig): Request {
  return async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': cfg.lang(),
      'X-App-Version': cfg.appVersion,
    };
    const token = cfg.token();
    if (token) headers.Authorization = `Bearer ${token}`;
    // PUT is refused by the UAT server (IIS answers 405): send POST and name the real method.
    let wire: string = method;
    if (method !== 'GET' && method !== 'POST') {
      headers['X-HTTP-Method-Override'] = method;
      wire = 'POST';
    }
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs ?? 15000);
    let res: { status: number; json(): Promise<unknown> };
    try {
      res = await cfg.fetch(cfg.baseUrl().replace(/\/+$/, '') + path, {
        method: wire,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch {
      throw new ApiError('OFFLINE', 'No connection to the scoring server');
    } finally {
      clearTimeout(timer);
    }

    let json: Envelope<T> | null = null;
    try {
      json = (await res.json()) as Envelope<T>;
    } catch {
      json = null;
    }
    if (json && json.ok) return json.data as T;
    const e = json?.error;
    throw new ApiError(e?.code ?? 'SERVER_ERROR', e?.message ?? `Server error (${res.status})`, res.status, e?.params ?? {});
  };
}
