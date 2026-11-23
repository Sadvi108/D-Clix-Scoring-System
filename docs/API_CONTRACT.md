# D-Clix Scoring System — backend API contract

For the backend developer. The mobile app talks to the backend only through the
`ScoringApi` interface in `src/data/ScoringApi.ts`. Today that interface is served by
`MockScoringApi` (in-app prototype data). Your job is to provide the real service so
`HttpScoringApi` (`src/data/http/HttpScoringApi.ts`) can implement the same interface.

Switch the app to the real backend with two environment variables (no screen changes):

```bash
EXPO_PUBLIC_API_MODE=http
EXPO_PUBLIC_API_URL=https://your-server/api
```

Names follow the MAASUAT `[tms].Poomsae*` tables and the V2.0 design. Routes below are
suggestions in REST form; keep the request/response shapes and the rules.

---

## 1. Principles (non-negotiable)

1. **Server calculates.** Accuracy, presentation, totals, trims and results are computed
   on the server from stored events, in DECIMAL. The app's figures are a preview only.
2. **Idempotent writes.** Every TAP/UNDO carries `clientRequestId`; every SEND carries
   `idempotencyKey`. Retrying the same request must not create a second record.
3. **Receipts, not optimism.** The app shows "Sent" only after the SEND response returns
   `submissionId` + `receivedAt` (server time).
4. **Released only to the public.** The display endpoint never returns unreleased figures.
5. **No destructive edits.** UNDO appends a reversal; corrections create a new revision
   with a reason; every action is written to `PoomsaeAuditLog`.
6. **Role checks per request.** A judge can only act on their own assignment and the
   currently open performance.

---

## 2. Live updates

The app keeps one live snapshot (`ScoringSnapshot` in `ScoringApi.ts`) and re-renders on
every change. Provide either:

- **WebSocket (preferred):** `GET /ws?token=…` pushing events
  `performance.updated`, `submission.received`, `result.updated`, `display.changed`,
  `judge.presence`, each carrying the changed object; or
- **Polling (Phase 1 fallback):** `GET /rings/{ringId}/state` every 2–3 s returning the
  full snapshot (shape below).

### Snapshot shape (role-filtered by the server)

```jsonc
{
  "ring": { "id": "R-A", "name": "Ring A", "session": "Session 1 · 09:00–13:00" },
  "rules": { /* RuleSet: see §6 */ },
  "queue": [ /* Performance[] for this ring session */ ],
  "current": { /* Performance or null */ },
  "judges": [ { "assignmentId": "A-83", "judgeNo": 3, "officialId": "TO-0877", "name": "…", "nat": "SWE", "online": true } ],
  "submissions": [ /* JudgeSubmission[] — chief referee only; judges get only their own; operator gets judgeNo + receivedAt only */ ],
  "result": { /* RoundResult or null — chief referee; display only when released */ },
  "display": "CALLUP" | "LIVE" | "RESULT"
}
```

`Performance`, `JudgeSubmission`, `RoundResult`, `ScoreEvent` field lists are in
`src/core/types.ts` (they map to PoomsaePerformance, PoomsaeJudgeSubmission,
PoomsaeRoundResult, PoomsaeScoreEvent).

### Performance status lifecycle

```
QUEUED → CALLED → ON_MAT → OPEN → COMPLETE → WITH_RIC → RELEASED
   └──────────┴────────→ WITHDRAWN   (only before OPEN, confirmed by chief referee)
```

`COMPLETE` is set by the server when every assigned judge has sent.

---

## 3. Judge endpoints

| App method | Route | Body | Returns | Rules |
| --- | --- | --- | --- | --- |
| `signInJudge(seat, pin)` | `POST /poomsae/auth/judge` | `{ seat, pin, deviceId }` | `{ token, assignment }` | PIN tied to one assignment; lock after 5 failures; new sign-in ends older session on that seat |
| `signInWithCode(code)` | `POST /poomsae/auth/judge-code` | `{ code, deviceId }` | same | QR code single-use, expires in 60 s |
| `autoSignIn(seat)` | — | — | — | Prototype only (no credentials), off by default (`AUTO_SIGN_IN` in `src/config.ts`); no endpoint needed |
| `signInPin(pin)` | POST | `/poomsae/auth/pin` | `{ pin }` → `{ token, officialId, name, role: 'JUDGE'\|'CHIEF'\|'OPERATOR' }` | One 6-digit PIN per official; the PIN decides the role |
| `takeSeat(ringId, judgeNo)` | POST | `/poomsae/rings/{ringId}/seats/{judgeNo}` | → `{ assignmentId }` | 409 if the seat is taken |
| `chooseRing(ringId)` | POST | `/poomsae/rings/{ringId}/open` | → 204 | Operator or chief opens a ring |
| `setPaused(paused)` | POST | `/poomsae/attempt/pause` | `{ paused }` | Locks every judge and stops the clock |
| `stopGame(reason)` | POST | `/poomsae/attempt/stop` | `{ reason }` | Ends the game early; judges who sent keep their score |
| `signOut()` | `POST /poomsae/auth/logout` | — | `204` | |
| (load) | `GET /poomsae/attempt/current` | — | `{ performance, myEvents, mySubmission }` | Only the judge's own data |
| `tap(side, code)` | `POST /poomsae/event` | `{ performanceId, side, type: "TAP", deductionCode, clientRequestId }` | `ScoreEvent` | Performance must be OPEN; reject if accuracy would go below 0; idempotent on `clientRequestId` |
| `undo(side)` | `POST /poomsae/event` | `{ performanceId, side, type: "UNDO", reversesEventId, clientRequestId }` | `ScoreEvent` | Reverses the judge's latest active TAP for that side |
| `submit()` | `POST /poomsae/score/submit` | see below | `JudgeSubmission` | One current submission per judge/revision; idempotent on `idempotencyKey`; validate ranges |

Criterion values are kept on the device until SEND (no per-tap server write).

**Submit body**

```jsonc
{
  "performanceId": "P-101",
  "ruleSetId": 1, "ruleSetVersion": 1,
  "idempotencyKey": "IDEM-…",
  "sides": {
    "chung": { "criteria": [1.8, 1.7, 1.8] },   // presentation per criterion, ruleset order
    "hong":  { "criteria": [1.9, 1.8, 2.0] }    // PK only
  }
}
```

The server derives accuracy from the stored TAP/UNDO events and returns the full
`JudgeSubmission` including `accuracy`, `presentation`, `total` per side, `revision`,
`receivedAt`.

---

## 4. Ring operator endpoints

| App method | Route | Effect |
| --- | --- | --- |
| `callPerformance(id)` | `POST /poomsae/performance/{id}/call` | QUEUED → CALLED (mat must be free) |
| `confirmOnMat()` | `POST /poomsae/performance/{id}/on-mat` | CALLED → ON_MAT |
| `openScoring()` | `POST /poomsae/performance/{id}/open` | ON_MAT → OPEN; judges' devices switch to scoring |
| `setClock(start/stop/reset)` | `POST /poomsae/performance/{id}/clock` `{ action }` | Only while OPEN; reset refused after any SEND |
| `handToReferee()` | `POST /poomsae/performance/{id}/hand-to-ric` | COMPLETE → WITH_RIC |
| `withdraw(id)` | `POST /poomsae/performance/{id}/withdraw` | Before OPEN; needs RIC confirmation |
| `setDisplay(mode)` | `POST /poomsae/rings/{ringId}/display` `{ mode }` | `RESULT` only after release |

The operator never receives judges' figures.

## 5. Chief referee endpoints

| App method | Route | Rules |
| --- | --- | --- |
| (monitor) | `GET /poomsae/operator/monitor` | Submission status; figures once panel complete |
| `releaseResult()` | `POST /poomsae/result/release` `{ performanceId }` | State COMPLETE or WITH_RIC; no unresolved tie; audited |
| `requestCorrection(judgeNo, reason)` | `POST /poomsae/score/correct` `{ performanceId, judgeNo, reason }` | Reason required; before release only; reopens that judge (status back to OPEN), they send revision n+1, result recalculated |
| `decideBout(performanceId, winner)` | `POST /poomsae/bouts/{performanceId}/decision` `{ winner }` | Walkover or equal PK score only; audited |

## 5a. Setup, ranking and qualification (phases 1–3, 5–7)

Full design, data model and trade-offs: [PHASES_DESIGN.md](PHASES_DESIGN.md).

| App method | Route | Rules |
| --- | --- | --- |
| `updateRuleSet(id, patch)` | `PATCH /poomsae/rulesets/{id}` | DRAFT only; deductions 0.1–1.0; criteria min < max; Σ criterion max ≤ presentation max |
| `approveRuleSet(id)` | `POST /poomsae/rulesets/{id}/approve` | Needs criteria; locks the version and approves the trim method |
| `updateRound(id, patch)` | `PATCH /poomsae/rounds/{id}` | SETUP/READY only; 1–2 forms (PK: 1); judges 3/5/7 |
| `setPanelSize(n)` | `PUT /poomsae/rings/{ringId}/panel` `{ judgeCount }` | Refused while a performance is on the mat |
| `assignSeat(judgeNo, officialId)` | `PUT /poomsae/rings/{ringId}/panel/seats/{judgeNo}` | Judges only; moving an official clears their old seat; ends the seat's pairing |
| `pairDevice(judgeNo)` | `POST …/seats/{judgeNo}/pairing-code` | Returns a single-use code valid 60 s |
| `unpairDevice(judgeNo)` | `DELETE …/seats/{judgeNo}/device` | Ends that device's session |
| `resolveTie(roundId, order)` | `POST /poomsae/rounds/{id}/tie-break` `{ entryIds }` | Chief referee; audited |
| `confirmQualification(roundId)` | `POST /poomsae/rounds/{id}/qualify` | Round SCORED; no tie on the cut line (or medal line in a final); writes P_Qualification; creates next round entries/bouts |
| `scheduleRound(roundId)` | `POST /poomsae/rounds/{id}/schedule` `{ ringId }` | Round READY; creates performances in the ring queue |

`callPerformance` also refuses when the round's panel size differs from the ring panel, a seat has
no judge or no paired device, or the rule set is not configured.

The snapshot adds `setup`, `results`, `audit` and `correction` (see `ScoringSnapshot`).

## 6. Rules the server must implement (from the V2.0 design)

- Recognized: Accuracy max 4.0; deductions ACC_01 = 0.1, ACC_03 = 0.3; Presentation max 6.0
  from three criteria (POWER_SPEED, RHYTHM_TEMPO, ENERGY), each 0.0–2.0 step 0.1
  (Min/Step are NULL in RuleSet 1 — confirm before go-live).
- Panel 3 judges: average all. 5 or 7: drop one highest and one lowest judge total, average
  the rest. **TrimMode is PENDING_APPROVAL** — the prototype uses total-wise trimming and,
  on equal values, drops the lowest judge number. Replace with the approved rule.
- Display 3 decimals on monitors; official result 4 decimals.
- Freestyle (Cut-off only, reject PK): no TAP events. RuleSet 2 lists 10 items with `group`:
  6 TECHNICAL (each 0.0–1.0, sum = technical skills, max 6.0) and 4 PRESENTATION (each 0.0–1.0, max 4.0).
  The submit body sends all 10 values in `criteria` (ruleset order); the server returns
  `accuracy` = technical sum, `presentation`, `total`. Items are DRAFT pending WT confirmation.
- Cut-off performances have one entry (`chung` only); `hong` is PK only. Side display order on a device
  (Chung left or Hong left) is a client preference and never changes stored data.
- Ties: no automatic winner; the chief referee decides (rematch / approved tie-break).

## 7. Prototype data

`src/data/mock/seed.ts` holds the demo ring, five judges (demo PIN `1234` for every seat),
four PK bouts and one Cut-off entry, plus the deterministic scores of the simulated judges.
Use it as test fixtures when building the real endpoints.

## Health check

`GET /poomsae/health` → `200 { "ok": true }`, no auth. Used by the app's Device connection screen to test the wired or Wi-Fi link to the server.
