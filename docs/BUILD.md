# Building the installable app (EAS)

Builds run in Expo's cloud (EAS Build), so no local Xcode or Android Studio is needed.
Profiles are in [`eas.json`](../eas.json):

| Profile | What you get | Use it for |
| --- | --- | --- |
| `preview` | Android **APK** / iOS **ad hoc** build, installed straight onto devices | The committee demo devices |
| `preview-simulator` | iOS **simulator** build (no Apple device registration) | Trying the build on a Mac |
| `production` | Store builds (Android App Bundle, iOS App Store), build numbers auto-increment | TestFlight / Play Console, later the stores |

Build numbers are managed by EAS (`appVersionSource: "remote"`), so nobody edits them by hand.

## One-time setup (done by you — needs your accounts)

1. **Set the real app ID** in `app.json` (replace the placeholder in both places):
   `ios.bundleIdentifier` and `android.package`, e.g. `com.yourcompany.dclixscoring`.
   It cannot be changed after the first store upload.
2. **Log in to Expo** (create a free account at expo.dev if needed):
   ```bash
   npx eas-cli@latest login
   ```
3. **Link the project** (adds an `extra.eas.projectId` to `app.json`):
   ```bash
   npx eas-cli@latest init
   ```

## Android demo build (simplest, recommended for Monday)

```bash
npm run build:android
```

When it finishes (≈10–20 min), EAS shows a link and QR code. Open it on each Android
phone/tablet and install the APK (allow "install unknown apps" when asked).

## iOS demo build

Choose one:

**A. Ad hoc (`preview`) — direct install on registered devices**
```bash
npx eas-cli@latest device:create   # register each iPhone/iPad (open the link on the device)
npm run build:ios                  # EAS creates the signing certificate and profile
```
Install from the link/QR the build page gives. Every new device needs registering and a
rebuild. Apple can take **24–72 hours** to accept new devices on new or recently renewed
developer memberships — register devices today if you use this route.

**B. TestFlight (`production` + submit)**
```bash
npm run build:store     # or: npx eas-cli@latest build --platform ios --profile production
npm run submit:ios      # uploads to App Store Connect; follow the prompts
```
Add the demo testers as internal testers in App Store Connect → TestFlight. Allow time for
Apple's processing after upload.

**Try it on the Mac first (no Apple device needed):**
```bash
npm run build:ios-sim
```

## Before the demo

- Rehearse on the actual devices with this build (not Expo Go).
- The prototype runs entirely on one device with sample data: no server or Wi-Fi needed.
- Charge the devices; the judge screens keep the display awake during scoring.
