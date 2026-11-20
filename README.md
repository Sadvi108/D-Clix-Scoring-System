# D-Clix Scoring System (mobile app)

Electronic scoring for Taekwondo Poomsae: judges score on phones or tablets, the ring
operator runs the mat, the chief referee releases results, and the scoreboard shows them.
Built with **Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router**.

> Prototype: all data is sample data served by an in-app mock backend. The real backend
> plugs in behind one interface — see [docs/API_CONTRACT.md](docs/API_CONTRACT.md).

## Install on Android (v1.0.0)

Download `D-Clix-Scoring-System-v1.0.0.apk` from the
[GitHub release](https://github.com/Sadvi108/D-Clix-Scoring-System/releases/tag/v1.0.0)
and open it on the tablet or phone (allow "install unknown apps" for your browser or file manager).
The prototype runs entirely on the device with sample data; no server or login is needed.

## Run it

```bash
npm install
npx expo start
```

- **iOS Simulator:** press `i`. **Android emulator:** press `a`.
- **Real phone/tablet:** install **Expo Go**, scan the QR code (same Wi-Fi as the laptop).
- Installable build for the demo devices: see [docs/BUILD.md](docs/BUILD.md)
- Wired (USB-C Ethernet) connection and USB keypad for judges: see [docs/DEVICE_CONNECTION.md](docs/DEVICE_CONNECTION.md)
  (`npm run build:android`, `npm run build:ios`, `npm run build:store`).

Checks: `npx tsc --noEmit` and `npx expo lint`.

## Committee demo flow (one device)

0. **Competition setup** (optional) → rule sets, categories and rounds, Ring A panel and paired devices.
1. **Ring operator** → call match 101 → confirm on mat → open scoring.
2. **Judge** → opens already signed in as Judge 3 (no ID or PIN) → score Chung and Hong → Send twice.
   On a phone, PK scoring rotates to landscape; Cut-off stays portrait with a review sheet.
   PK: Chung is blue (left) and Hong red (right) by default; the ⇄ button on the judge screen and
   the scoreboard swaps sides for that device. Scores stay with the athlete, not the screen side.
   Cut-off: one athlete at a time, always blue. Freestyle (match F-1, a pair) has its own screen:
   6 technical-skill items (6.0) + 4 presentation items (4.0), no deduction keys.
3. **Chief referee** → panel complete (other judges are simulated) → optionally *Request correction*
   (pick a judge + reason; that judge re-sends revision 2) → Release.
4. **Scoreboard** → released result with trimmed judges and the winner.
5. **Results** → Male Under 30 shows the bout decided; Male Under 17 has a tie on the qualification
   line → order it → *Confirm qualification* → Semi-final is ready → *Send to Ring A queue*.
   Male Over 30 shows a confirmed final with medals. *Audit log* lists every action.

The menu button (top-left of each screen) goes back to the role menu. "Reset demo data"
on the role menu starts over. Tap any queued bout on the operator screen to call it
(P-12 is the Cut-off example).

## Project layout

```
src/
  app/                 Routes (Expo Router)
    index.tsx            Role menu
    judge/sign-in.tsx    QR / PIN sign-in (off in the prototype: AUTO_SIGN_IN in src/config.ts)
    judge/index.tsx      Standby → PK or Cut-off scoring (locks orientation on phones)
    operator.tsx         Ring operator console
    referee.tsx          Chief referee monitor + release
    scoreboard.tsx       Venue display
    admin.tsx            Phases 1–3: rules, categories & rounds, panel & devices
    results.tsx          Phases 5–7: standings, ties, qualification, medals, audit log
  core/types.ts        Sport-agnostic domain types (Performance, ScoreEvent, …)
  sports/poomsae/      Rule profiles, pure scoring engine (integer tenths, trims) and ranking rules
  data/                ScoringApi contract, mock backend, HTTP skeleton, useScoring() hook
  features/            Screen bodies (judge, officials)
  ui/                  Design-system components (D-Clix Scoring System tokens)
  theme/               Tokens (Arena dark / Daylight light), fonts, type scale
docs/API_CONTRACT.md   What the backend must provide
docs/PHASES_DESIGN.md  Design for phases 1–3 and 5–7 (data model, API, trade-offs)
```

### Adding another sport later

Add `src/sports/<sport>/` with its rules and pure scoring functions, its judge screens under
`src/features/`, and reuse `core`, `data`, `ui` and the officials' flow. Poomsae is the
first module, not a special case.

## Design

Screens follow the D-Clix Scoring System design system ("Hanji & Ink"): Arena (dark) for judges
and the scoreboard, Daylight (light) for officials' consoles; Saira Condensed for numerals,
IBM Plex Sans for text.

## Open items before production

- Judge login is switched off for the prototype (`AUTO_SIGN_IN = true` in `src/config.ts`):
  every device signs in as Judge 3. Set it to `false` to bring back the QR / PIN screen.

- Trim method, criterion min/step, tie-break and Freestyle criteria await rule sign-off
  (shown in the app as DRAFT / pending).
- Bundle id `com.example.dclixscoring` is a placeholder — set your own in `app.json`.
- Freestyle items and ranges (each 0.0–1.0) follow the WT Freestyle sheet as a DRAFT; confirm before go-live.
  Time and boundary penalties (referee deductions) are not built yet.
- PK bouts use one form; ranking tie-break (presentation, then chief referee) is a draft rule.
- Judge substitution mid-performance and multiple rings at once are not simulated.
