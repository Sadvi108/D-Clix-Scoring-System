# API wiring design

Date: 2026-11-24
Status: approved in discussion, waiting for written review

## Goal

Run the app on the real D-Clix Scoring System API (OpenAPI 1.3.4,
`https://www.maclubsystem.com/Competitionuat/api/v1`). The API is the source of truth for
features and behaviour. The web app (`live.php`) is the reference for response shapes and
flows that the OpenAPI document leaves as plain `object`.

## Decisions

| # | Decision |
|---|----------|
| 1 | **API only.** The in-app mock no longer drives the app. Demos and tests run against UAT. |
| 2 | **Screens without an API stay, disconnected.** Admin (rule sets, rounds, panel, pairing), the chief "request correction" action and the role menu keep their UI and show "Managed in TMS" with actions off. The scoreboard stays and reads the public display feed `GET /display/{key}`. |
| 3 | **Offline outbox** for judge score sends. |
| 4 | **Keep our screens** (tablet-manual layout, boss rules) and rewire them to the API. Add what the API offers and we lack; remove what it cannot do. |
| 5 | **API-shaped data layer** (approach 2): a typed client plus small runtime stores and hooks. No adapter to the old snapshot, no code generation, no React Query. |

## Architecture

```
src/api/        typed client, no React
  client.ts     fetch wrapper: base URL, Bearer token, Accept-Language, X-App-Version.
                Unwraps {ok,data}; throws ApiError {code, message, params, http}. 15 s timeout.
                Network failure throws code OFFLINE.
  types.ts      server shapes: Profile, Rings, RingState, Current, Clock, Seat, Sheet, Receipt,
                Review, Options, Overview, HistoryList, HistoryDetail, Rounds, RoundResults,
                Display, Meta, Languages, Texts.
  endpoints.ts  one function per endpoint (see "Endpoint map").
src/live/       runtime state; small stores read with useSyncExternalStore
  session.ts    token + profile in AsyncStorage; device id (uuid, stored once); boot with
                GET /me; sign-out on AUTH_REQUIRED / TOKEN_EXPIRED / RESEATED; DEVICE_IN_USE
                takeover.
  ringState.ts  poller for GET /ring/state: 1 s while scoring or a console is open, 3 s on
                standby, 2 s retry offline. Judges send `since`. Tracks conn and lastSync.
                Sends `unsent` from the outbox.
  outbox.ts     queued score sends in AsyncStorage (see "Outbox").
  judgeDraft.ts local values per game|form|corner; restore from current.my.draft;
                PUT /draft debounced 600 ms.
  texts.ts      GET /languages and /texts/{lang}, cached with version; t(key, params) with
                English fallback.
  hooks.ts      useSession, useRingState, useSheet, useReview, useOptions, useOverview,
                useHistory, useHistoryOne, useRounds, useRoundResults, useConn, useT.
src/data/legacy/ old ScoringApi, MockScoringApi and seeds, imported only by the
                 disconnected admin and correction UI.
```

`sports/poomsae/scoring.ts` and `rules.ts` no longer compute totals. The judge screen shows a
provisional total from the sheet (accuracy max minus deductions, plus items), as `live.php`
does. The server's figures are official.

Base URL: `EXPO_PUBLIC_API_URL` (default UAT). `device/settings.serverUrl` (Connection screen)
overrides it on a tablet.

## Endpoint map

| Area | Endpoints |
|------|-----------|
| Start | `GET /meta`, `GET /languages`, `GET /texts/{lang}` |
| Sign-in | `POST /auth/login`, `POST /auth/logout`, `GET /me` |
| Rings and seats | `GET /rings`, `POST /seat/claim`, `POST /seat/release` |
| Live | `GET /ring/state`, `PUT /ring/display`, `POST /ring/display-link`, `GET /display/{key}` |
| Judge | `GET /games/{id}/sheet`, `PUT /games/{id}/draft`, `POST /games/{id}/scores` |
| Clock | `POST /games/{id}/start`, `/pause`, `/resume`, `/stop` |
| Result | `GET /games/{id}/review`, `POST /games/{id}/release`, `/declare`, `/walkover`, `/tie` |
| Operator | `POST /games/{id}/enter-for-seat`, `/no-show`, `/withdraw` |
| PK forms | `GET` / `PUT /games/{id}/forms` (client only; no screen in this pass) |
| More actions | `GET /games/{id}/options`, `POST /games/{id}/penalty`, `POST /penalties/{id}/void`, `POST /games/{id}/restart`, `/disqualify`, `/reinstate` |
| Chief | `GET /rings/overview`, `GET /history`, `GET /history/{id}`, `GET /rounds`, `GET /rounds/{id}/results`, `POST /rounds/{id}/qualify` |

## Flows and screens

### Start and sign-in

- App start: `GET /meta?platform&version`. `update: FORCE` blocks with a store link;
  `maintenance` shows a banner.
- With a stored token: `GET /me`. A profile with a ring (and a seat for judges) goes straight
  to the work screen; otherwise `/rings`.
- Sign-in (`/sign-in`): PIN → `POST /auth/login` with device `{id, label, platform,
  appVersion}` and `lang`. `DEVICE_IN_USE` asks "Take over from {deviceLabel}?" and resends
  with `confirmReplace: true`.
- Rings (`/rings`, `GET /rings`): judges tap a used, free seat (`POST /seat/claim {ring,
  seat}`); operator and chief tap "Open ring" (`{ring}`). Then `GET /me`.
- Chief: after claiming, `/referee`; the chief tabs (`/chief/*`) stay reachable.

### Judge (`/judge`)

Data: `/ring/state` `current` and `GET /games/{id}/sheet`.

- Deduction keys from `sheet.sections[0].keys` with count and per-key undo; items from
  `sections[1].items`; the number grid lists min..max on `step`. PK: blue and red panes, swap
  supported. Cut-off: one pane.
- Locked when `!scoringOpen` (banner: waiting for the operator, paused or stopped), when
  `my.sent`, or when `method` is `OTHER` (read-only "Scored by another method").
- Every item must be picked before Send. Send opens the confirmation sheet, then the outbox.
- Draft saved 600 ms after each change; restored from `my.draft` after a restart.
- A new game or form resets local values and fetches the sheet again.

### Operator and chief console (`/operator`, `/referee`)

- Queue: `previous`, current, `next` from the state.
- Clock from `current.clock`: remaining or elapsed ticking between polls, break countdown,
  "Time up". Buttons by stage: `ON_MAT` → Start form N; `SCORING_OPEN` → Pause, Stop;
  paused → Resume, Stop.
- Judge tiles from `seats`: EMPTY, WAITING, DRAFT, SENT, OFFLINE, unsent count, device,
  totals. Tile sheet: Enter scores (`enter-for-seat`, full grid or `useMax`, reason required)
  and Free seat (`POST /seat/release`).
- Live judge table from `seats[].draft` and sent totals.
- When stage is `JUDGES_SENT` or `WITH_CHIEF`, or the clock is `STOPPED`: `GET /review` shows
  the provisional result with trim marks and the PK suggestion.
  - PK: Declare blue or red (confirmation, optional reason). `suggested: TIE`: chief only.
  - Cut-off: Release. Outcome `TIE_OPEN`: the chief sees the tie panel (winner, or rematch with
    a chosen form).
- PK walkover (absent corner, NO_SHOW / WITHDRAWN / DISQUALIFIED). Cut-off no-show or withdraw
  while `ON_MAT` (reason required).
- More actions (`GET /options`): penalty with types per rule set (`appliedBy`,
  `requireReason`); chief: remove penalty, restart, re-perform, disqualify, reinstate.
- Display: Call-up, Live clock, Result (`PUT /ring/display`) and the TV link
  (`POST /ring/display-link`) with copy and open.

### Chief screens

- `/chief`: `GET /rings/overview`, polled every 3 s. "Open this ring" claims the ring.
- `/chief/history` and `/chief/game/[id]`: `GET /history` (ring switch, search) and
  `GET /history/{id}` (result, referee figures, audit from the server).
- `/chief/rounds`: `GET /rounds`; tapping a round opens `/results?round=` →
  `GET /rounds/{id}/results` with "Confirm qualifiers" when `canConfirm`.

### Header on signed-in screens

Ring, game and category, clock, heartbeat dot (online or offline with last sync), swap sides
(stored per tablet; default from `settings.swapCorners`), globe (only when the server has 2 or
more languages), user menu (change ring or seat, sign out).

### Scoreboard (`/scoreboard?key=`)

`GET /display/{key}` polled every 1 to 2 s. Shows only what the API allows.

## Errors and offline

One path keyed on `ApiError.code`:

- `AUTH_REQUIRED`, `TOKEN_EXPIRED`, `RESEATED`: clear token, go to sign-in with the message.
- `RING_NOT_CHOSEN` or `ring: null` in the state: go to `/rings`.
- `DEVICE_IN_USE`: takeover prompt. `SWITCH_BLOCKED`: "You have an unsent draft on this seat".
- `PANEL_INCOMPLETE`, `WRONG_STAGE`: refresh the state.
- `CLOCK_NOT_RUNNING`: paused banner. `RATE_LIMITED`: wait and retry.
- Anything else: toast with the server `message` (already in the chosen language).

Final actions (release, declare, walkover, stop, tie, qualify, restart, disqualify, reinstate,
enter-for-seat, void penalty) always open a confirmation sheet with a reason box (required
where the API requires it) before sending `confirmed: true`.

Heartbeat: a failed poll sets offline. A banner on every screen shows "Offline · last sync
hh:mm:ss"; polling retries every 2 s. Judges keep tapping locally; draft saves wait for the
connection. Operator and chief buttons are disabled while offline. The clock keeps ticking
from the last received state.

## Outbox

- Send creates `{clientRequestId (uuid), gameId, formNo, scores, clientTime, createdAt}`,
  saves it to AsyncStorage, then tries at once.
- Network failure: retry every 3 s and when the connection returns, with `offline: true` and
  the original `clientTime`, same `clientRequestId`.
- 200 or `duplicate: true`: remove, mark Sent with receipt time and revision.
- 409 or other 4xx: remove and show the server message (for example kept as a late event for
  the chief).
- The judge sees "Saved on this tablet · sending…" while queued, then "Sent".
- `/ring/state?unsent=N` reports the queue size; the operator tile shows it.
- The queue reloads on app start. Changing ring or seat is blocked while it is not empty.

Not in scope: offline actions for operator or chief; merging drafts across devices.

## Testing

Automated (`npm test` = `node --test` through `tsx`, no new framework):

- `api/client`: unwrap, `ApiError` mapping, headers, timeout and offline.
- `live/outbox`: same id on retry, `offline: true` on retry, removal on success or duplicate,
  409 surfaced, reload after restart.
- `live/judgeDraft`: provisional total and missing-item count from a sample sheet; restore from
  `my.draft`.
- Fixtures captured from UAT responses in `src/api/__fixtures__`, used by the screen mapping
  helpers.

Live UAT pass on the iPad simulator, once per role (judge, operator, chief), including a judge
send with Wi-Fi off. `tsc` and `expo lint` must pass.

Needed before the live pass: UAT PINs for judge, operator and chief (kept out of code and
git), and agreement that the test may change UAT data.

## Rollout

Commits on `main`. No APK until requested. Default base URL is UAT; the Connection screen can
change it.
