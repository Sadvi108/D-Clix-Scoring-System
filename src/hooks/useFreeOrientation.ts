import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';

/** Officials' and display screens follow the device; this releases any lock a judge screen set. */
export function useFreeOrientation() {
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
  }, []);
}
