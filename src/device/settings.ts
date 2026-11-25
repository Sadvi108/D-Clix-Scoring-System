// Per-device settings saved on the tablet: scoring server address and USB keypad on/off.
// Kept apart from the scoring snapshot because they belong to this device, not to the ring.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type DeviceSettings = {
  /** Scoring server address, e.g. http://192.168.1.10:8080/api/v1. Empty = the UAT server. */
  serverUrl: string;
  /** Listen for a USB (or Bluetooth) keypad on the judge screens. */
  keypad: boolean;
};

const KEY = 'dclix.device.v1';
let state: DeviceSettings = { serverUrl: process.env.EXPO_PUBLIC_API_URL ?? '', keypad: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

let loaded: Promise<void> | null = null;
/** Read saved settings once at start-up. */
export function loadDeviceSettings() {
  loaded ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (raw) {
        state = { ...state, ...(JSON.parse(raw) as Partial<DeviceSettings>) };
        emit();
      }
    })
    .catch(() => {});
  return loaded;
}

export function updateDeviceSettings(patch: Partial<DeviceSettings>) {
  state = { ...state, ...patch };
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export const getDeviceSettings = () => state;

export function useDeviceSettings(): DeviceSettings {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}

/** Normalise what an official types: adds http:// and drops a trailing slash. */
export function normaliseServerUrl(input: string) {
  const t = input.trim().replace(/\/+$/, '');
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `http://${t}`;
}
