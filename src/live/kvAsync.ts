import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KV } from './kv';

/** KV over AsyncStorage: survives app restarts. */
export const asyncStorageKV: KV = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  remove: (k) => AsyncStorage.removeItem(k),
};
