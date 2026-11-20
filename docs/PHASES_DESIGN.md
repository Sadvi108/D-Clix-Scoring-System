# D-Clix Scoring System — design for phases 1–3 and 5–7

Companion to `API_CONTRACT.md`. Phase 4 (live scoring) is already in the app; this document
covers the rest of the implementation plan ("Implementation plan by PIC", 2026-11-16) and how the
prototype implements each phase against the in-app mock backend.

| Phase | Tables | App surface |
| --- | --- | --- |
| 1 Master rules and scoring settings | P_RuleSet, P_DeductionType, P_PresentationCriterion | Admin › Rules |
| 2 Tournament category and round setup | P_CategoryRound, P_RoundForm | Admin › Rounds |
| 3 Judge assignment and phone connection | P_JudgeAssignment | Admin › Panel & devices |
| 4 Player performance and live scoring | P_Performance, P_ScoreEvent, P_JudgeSubmission | Judge, Operator, Chief referee (built) |
| 5 Score calculation and ranking | P_RoundResult | Results › Standings |
| 6 Qualification and next round | P_Qualification | Results › Confirm qualification / Send to ring |
| 7 Final results and audit history | P_AuditLog | Results › Final standings, Audit log |

---

## 1. Requirements

**Functional**

- Phase 1: rule sets are versioned. A DRAFT rule set can be edited (deduction values, criterion
  min/max/step, trim mode); approving it locks it. Freestyle exists as a rule set but stays
  "not configured" until WT criteria are entered.
- Phase 2: each TMS category has a mode (Cut-off, PK, PK + Cut-off) and ordered rounds. Each round
  has a format, rule set, forms (1–2, linked to TMS forms), panel size (3/5/7) and how many entries
  advance.
- Phase 3: a ring panel has a size and one TMS official per seat. Each seat pairs one device by a
  short-lived code. A performance cannot be called if its round needs a different panel size.
- Phase 5: Cut-off rounds rank entries by the average of their released form scores. PK bouts are
  decided by the higher final score. Ties: higher presentation first; still tied → the chief
  referee decides (method pending sign-off).
- Phase 6: the chief referee confirms qualification once a round is fully scored and no tie sits
  on the cut line. Confirmation creates the next round's entries (Cut-off) or bouts (PK, winners
  paired in bracket order). The round is then sent to a ring queue.
- Phase 7: a confirmed final shows medals. Every state change is appended to an audit log
  (who, what, when, revision); nothing is edited in place.
- Corrections: the chief referee reopens one judge with a reason; that judge sends a new revision
  and the result is recalculated.

**Non-functional**

- One ring ≈ 5–7 judge devices + operator + chief referee + display; a championship ≈ 4–8 rings,
  so < 100 concurrent devices. Writes are tiny (taps, sends); reads are snapshot pushes.
- Live updates within 1 s on venue Wi-Fi; polling at 2–3 s is acceptable for Phase 1 of the backend.
- Results must be reproducible from stored events (DECIMAL on the server, integer tenths in the app).

**Constraints**

- Backend developer builds the API later; the app must run the full flow on sample data today.
- Rule details (trim method, criterion min/step, tie-break, Freestyle) await sign-off and are shown
  as DRAFT.

## 2. High-level design

```
 ┌───────────── Mobile app (Expo) ──────────────┐
 │ Admin   Judge   Operator   Referee   Results  │  screens
 │   └───────┴────────┴─────────┴─────────┘     │
 │              useScoring() snapshot            │
 │                    │                          │
 │           ScoringApi (one interface)          │
 │        ┌───────────┴───────────┐              │
 │  MockScoringApi          HttpScoringApi       │
 │  (prototype, on device)  (backend, later)     │
 └────────────────────────────┼─────────────────┘
                              │ REST + WebSocket
                  ┌───────────┴───────────┐
                  │ Poomsae service        │──▶ TMS (categories, forms,
                  │ rules · scoring ·      │     officials, entries)
                  │ ranking · audit        │
                  └───────────┬───────────┘
                          SQL Server [tms].Poomsae*
```

Pure functions in `src/sports/poomsae/` (`scoring.ts`, `ranking.ts`) hold the calculation and
ranking rules, so the same code can be ported to the server and unit-tested in isolation.

## 3. Data model (app types → tables)

| App type (`src/core/types.ts`) | Table | Key fields |
| --- | --- | --- |
| `RuleSet`, `DeductionType`, `PresentationCriterion` | P_RuleSet, P_DeductionType, P_PresentationCriterion | status DRAFT/APPROVED, version, trimMode |
| `Category` | (TMS category + Poomsae settings) | tmsCategoryId, discipline, division, mode |
| `CategoryRound`, `RoundForm` | P_CategoryRound, P_RoundForm | format, ruleSetId, judgeCount, advanceCount, status |
| `PanelSeat`, `Official` | P_JudgeAssignment | judgeNo, tmsOfficialId, deviceId, pairedAt |
| `Performance` (+ roundId) | P_Performance | status lifecycle |
| `EntryScore`, `Bout` | P_RoundResult | final, presentation, winner |
| `Qualification` | P_Qualification | rank, qualified, nextRoundId, decidedBy |
| `AuditEntry` | P_AuditLog | at, actor, action, target, detail |

Round status: `SETUP → READY → LIVE → SCORED → CONFIRMED`.

## 4. API additions

| Method | Route | Rule |
| --- | --- | --- |
| `updateRuleSet(id, patch)` | `PATCH /poomsae/rulesets/{id}` | DRAFT only; refused while any performance is OPEN |
| `approveRuleSet(id)` | `POST /poomsae/rulesets/{id}/approve` | needs criteria; locks the version |
| `updateRound(id, patch)` | `PATCH /poomsae/rounds/{id}` | SETUP/READY only |
| `setPanelSize(n)` | `PUT /poomsae/rings/{ringId}/panel` | 3/5/7; refused while a performance is on the mat |
| `assignSeat(judgeNo, officialId)` | `PUT /poomsae/rings/{ringId}/panel/seats/{judgeNo}` | one seat per official |
| `pairDevice(judgeNo)` | `POST …/seats/{judgeNo}/pairing-code` | code single-use, 60 s |
| `unpairDevice(judgeNo)` | `DELETE …/seats/{judgeNo}/device` | ends that device's session |
| `resolveTie(roundId, order)` | `POST /poomsae/rounds/{id}/tie-break` | chief referee; audited |
| `confirmQualification(roundId)` | `POST /poomsae/rounds/{id}/qualify` | round SCORED, no unresolved cut-line tie |
| `scheduleRound(roundId)` | `POST /poomsae/rounds/{id}/schedule` `{ ringId }` | creates performances in the ring queue |
| `requestCorrection(judgeNo, reason)` | `POST /poomsae/score/correct` | reopens that judge; new revision |

The snapshot gains `setup` (rule sets, categories, rounds, officials, panel), `results` (round
entries, scores, bouts, qualifications) and `audit`.

## 5. Trade-offs

| Decision | Chosen | Alternative | Why |
| --- | --- | --- | --- |
| Where ranking runs | Server (app preview only) | Client | One source of truth; app shows what the server returns |
| Admin on mobile | Tablet-first screens in the same app | Separate web admin | Committee demo needs one app; a web admin can reuse the same API later |
| Panel size per round vs per ring | Round declares size, ring panel must match | Auto-resize panel | Explicit mismatch error avoids a 3-judge panel scoring a 5-judge round |
| Next round creation | Explicit "Confirm qualification" then "Send to ring" | Automatic | Officials must sign off; audit shows who advanced whom |
| Tie at cut line | Blocks confirmation until chief referee orders | Automatic tie-break | Tie-break rule not approved yet |

## 6. What to revisit as it grows

- Multiple rings at once: the snapshot is per ring today; the results store is per tournament.
- Offline judge devices: a local send queue with idempotency keys (contract already supports it).
- Freestyle judge screen once its criteria are signed off.
- Web admin for tournament staff working from laptops.
- Exports: official result sheets (PDF) and TMS write-back.
