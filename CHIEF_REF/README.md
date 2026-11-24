# D-Clix Chief UI (All rings, History + detail, Rounds, header controls)

React + TypeScript + Vite. Works on tablet and phone; runs on demo data until an API URL is set.

## Run
```bash
npm install
npm run dev        # http://localhost:5173, also reachable from a tablet/phone on the same Wi-Fi (see the Network URL)
```

## Show it externally
```bash
npm run build && npm run preview      # production build, served on the LAN
```
`dist/` is a static site: upload it to any static host (Netlify, Vercel, GitHub Pages, S3) to share a public link.

## Connect the backend
Set `VITE_API_URL` (e.g. in `.env.local`): `VITE_API_URL=https://example.com/api`. Optionally `VITE_DISPLAY_URL` shows the venue-display link in the account menu.

The UI only uses the `ChiefApi` interface in `src/types.ts`. `src/api/mock.ts` is the demo implementation, `src/api/http.ts` the real one (endpoints listed at its top). Match the backend's JSON to the types, or adapt in `http.ts`.

## Structure
- `src/api/`: mock and HTTP implementations, chosen in `index.ts`
- `src/hooks/`: `useAsync` (load, poll, retry), `useDebounced`, `useRoute` (hash routes: `#/history/g101`)
- `src/pages/`: `RingsPage` (polls 3 s), `HistoryPage` (tabs + debounced search), `HistoryDetailPage`, `RoundsPage` (polls 5 s)
- `src/components/`: `Header` (nav, online status), `AccountMenu` (swap sides, language, TV link, sign out), `Loaded` (loading/error states)
