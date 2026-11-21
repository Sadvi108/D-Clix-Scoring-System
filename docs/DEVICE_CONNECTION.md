# Wired connection and USB keypad

Judge, operator and referee tablets can connect to the scoring server with a USB-C cable instead of
Wi-Fi, and judges can score with a USB numeric keypad. Both are set on each tablet under
**Menu › Device connection**.

## Wired network (USB-C Ethernet)

| Setup | Hardware |
| --- | --- |
| Network only | USB-C to Ethernet adapter, cable to the ring switch |
| Network + keypad | USB-C hub with Ethernet, a USB-A port for the keypad, and USB-C power in (Power Delivery) so the tablet charges all day |

- **Android** switches to the cable as soon as the adapter is plugged in. Wi-Fi can stay off.
- **iPad** shows an Ethernet entry in Settings once the adapter is connected.
- The status pill at the top of every screen shows **Wired**, **Wi-Fi** or **Offline**, read live
  from the device.
- The venue LAN usually has no internet. The app treats "has a network link" as connected and does
  not need the internet.
- **Server address**: type the scoring server's LAN address (e.g. `192.168.1.10:8080`) in Device
  connection and press **Test connection**. It calls `GET /poomsae/health` with a 4 s timeout. The
  address is saved on the tablet and overrides `EXPO_PUBLIC_API_URL`.
- Plain `http://` to a LAN address is allowed: Android `usesCleartextTraffic` (via
  `expo-build-properties`) and iOS `NSAllowsLocalNetworking` + `NSLocalNetworkUsageDescription` are
  set in `app.json`. These need a new native build (the v1.0.0 APK predates them).

Backend: add `GET /poomsae/health` → `200 { "ok": true }` with no auth.

## USB keypad for judges

Turn on **USB keypad for judges** in Device connection (off by default so tablets without a keypad
never show an on-screen keyboard). Any USB or Bluetooth numeric keypad works; no driver or app
build change is needed, and it also works in Expo Go.

| Key | Action |
| --- | --- |
| 7 / 9 | −0.3 major deduction, left / right athlete |
| 4 / 6 | −0.1 minor deduction, left / right athlete |
| 1 / 3 | Undo last deduction, left / right athlete |
| Enter | Send the score (OK in the number grid) |
| 0 or . | Cancel: back out of confirm or the review sheet |

- Left/right means the judge's screen, so the keys follow the ⇄ side swap in PK.
- Cut-off: both columns score the one athlete. Enter opens the review; Enter again sends.
- Freestyle: only Enter and cancel (items are set on screen).
- Presentation criteria stay on the touchscreen.
- The same locks apply as for touch: nothing is taken after the score is sent, and accuracy never
  goes below 0.
- Device connection has a **Keypad test** box that shows each key and what it does.

How it works: `src/device/keypad.tsx` keeps a hidden text field focused (`showSoftInputOnFocus`
off) and reads each typed key as the difference from the previous value, so fast typing never
double-counts. The key map is `keyToAction()` in the same file.

Files: `src/device/network.ts` (link type), `src/device/settings.ts` (saved server URL and keypad
switch), `src/device/keypad.tsx`, `src/app/connection.tsx`.
