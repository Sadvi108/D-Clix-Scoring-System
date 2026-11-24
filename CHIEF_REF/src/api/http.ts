import type { ChiefApi } from '../types';

/** Expected endpoints (agree the final contract with the backend):
 *  GET  {base}/chief/rings                  -> RingSummary[]
 *  GET  {base}/chief/history?ring=A&q=text  -> HistoryRow[]
 *  GET  {base}/chief/history/{id}           -> HistoryDetail   (chief roles only)
 *  GET  {base}/chief/rounds                 -> RoundSummary[]
 *  GET  {base}/chief/account                -> Account
 *  POST {base}/auth/sign-out
 *  Add auth headers in `request` once the backend defines them. */
export function httpApi(baseUrl: string): ChiefApi {
  async function request(path: string, init?: RequestInit) {
    const res = await fetch(baseUrl + path, { headers: { Accept: 'application/json' }, ...init });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return res;
  }
  const get = async <T,>(path: string) => (await request(path)).json() as Promise<T>;

  return {
    listRings: () => get('/chief/rings'),
    listHistory: ({ ringId, search }) =>
      get(`/chief/history?ring=${encodeURIComponent(ringId)}&q=${encodeURIComponent(search)}`),
    getHistoryDetail: (id) => get(`/chief/history/${encodeURIComponent(id)}`),
    listRounds: () => get('/chief/rounds'),
    getAccount: () => get('/chief/account'),
    signOut: async () => {
      await request('/auth/sign-out', { method: 'POST' });
    },
  };
}
