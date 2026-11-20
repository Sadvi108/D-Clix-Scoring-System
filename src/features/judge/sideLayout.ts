// Per-device PK layout: which corner sits on the left of this screen.
// Default is Chung (blue) left, Hong (red) right; a judge or display on the other side of the mat
// can swap so Hong is on the left. Scores stay attached to the athlete, never to the screen position.
import { useSyncExternalStore } from 'react';
import type { Side } from '@/core/types';

let swapped = false;
const listeners = new Set<() => void>();

export function toggleSides() {
  swapped = !swapped;
  listeners.forEach((l) => l());
}

/** [left side, right side, swapped] for this device. */
export function usePkSides(): { left: Side; right: Side; swapped: boolean } {
  const s = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => swapped, () => swapped);
  return s ? { left: 'hong', right: 'chung', swapped: true } : { left: 'chung', right: 'hong', swapped: false };
}
